import { merchantKey } from "../categories";
import type { Cents } from "../money";

export type Frequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface RecurringTxn {
  date: string; // YYYY-MM-DD
  merchant: string;
  amountCents: Cents; // negative outflow
}

export interface RecurringCandidate {
  merchantKey: string;
  merchant: string;
  frequency: Frequency;
  typicalAmountCents: Cents; // positive
  occurrences: number;
  lastObserved: string;
  nextExpected: string;
  estimatedAnnualCents: Cents;
  /** 0–1. Based on interval regularity and amount stability. */
  confidence: number;
  evidence: { date: string; amountCents: Cents }[];
}

const DAY = 86_400_000;
const WINDOWS: { f: Frequency; min: number; max: number; perYear: number; minOccurrences: number }[] = [
  { f: "WEEKLY", min: 6, max: 8, perYear: 52, minOccurrences: 4 },
  { f: "MONTHLY", min: 26, max: 35, perYear: 12, minOccurrences: 3 },
  { f: "QUARTERLY", min: 85, max: 97, perYear: 4, minOccurrences: 3 },
  { f: "YEARLY", min: 355, max: 375, perYear: 1, minOccurrences: 2 },
];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + days * DAY).toISOString().slice(0, 10);
}

/**
 * Infer recurring charges from transaction history. Results are SUSPECTED until a
 * user confirms them — interval regularity alone does not prove a subscription.
 */
export function detectRecurring(txns: RecurringTxn[]): RecurringCandidate[] {
  const groups = new Map<string, RecurringTxn[]>();
  for (const t of txns) {
    if (t.amountCents >= 0) continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const out: RecurringCandidate[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((Date.parse(sorted[i].date) - Date.parse(sorted[i - 1].date)) / DAY);
    }
    const medGap = median(gaps);
    const window = WINDOWS.find((w) => medGap >= w.min && medGap <= w.max);
    if (!window || sorted.length < window.minOccurrences) continue;

    const amounts = sorted.map((t) => -t.amountCents);
    const medAmount = median(amounts);
    const amountStable = amounts.filter((a) => Math.abs(a - medAmount) <= medAmount * 0.15).length / amounts.length;
    if (amountStable < 0.75) continue;
    const intervalRegular = gaps.filter((g) => g >= window.min && g <= window.max).length / gaps.length;
    if (intervalRegular < 0.6) continue;

    const typical = Math.round(medAmount);
    const last = sorted[sorted.length - 1];
    out.push({
      merchantKey: key,
      merchant: last.merchant,
      frequency: window.f,
      typicalAmountCents: typical,
      occurrences: sorted.length,
      lastObserved: last.date,
      nextExpected: addDays(last.date, Math.round(medGap)),
      estimatedAnnualCents: typical * window.perYear,
      confidence: Math.round(((amountStable + intervalRegular) / 2) * Math.min(1, sorted.length / (window.minOccurrences + 2)) * 100) / 100,
      evidence: sorted.slice(-6).map((t) => ({ date: t.date, amountCents: -t.amountCents })),
    });
  }
  return out.sort((a, b) => b.estimatedAnnualCents - a.estimatedAnnualCents);
}

export function annualize(amountCents: Cents, frequency: Frequency | "UNKNOWN"): Cents | null {
  const w = WINDOWS.find((x) => x.f === frequency);
  return w ? amountCents * w.perYear : null;
}
