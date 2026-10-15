/**
 * Opportunity outcomes: verifying whether an action on a recurring charge actually worked,
 * and keeping estimated, initiated, confirmed and realized value strictly separate.
 *
 * Verification only uses the user's own later transactions:
 * - Cancel: confirmed when no charge from the merchant appears after the action, and the
 *   user's transaction data reaches past the next expected charge date (plus a grace period).
 *   Without data covering that date, the outcome stays pending; absence of data is not proof.
 * - Negotiate / switch plan: confirmed when a later charge is lower than the original amount.
 * Realized value counts only what actually didn't get charged (or the measured reduction).
 */
import type { Cents } from "../money";
import type { Frequency } from "./recurring";

export type RecurringActionKind = "cancel" | "negotiate";
export type OutcomeStatus = "pending" | "confirmed" | "not_confirmed";

const CYCLE_DAYS: Record<Frequency, number> = { WEEKLY: 7, MONTHLY: 30.44, QUARTERLY: 91.3, YEARLY: 365.25 };
const GRACE_DAYS: Record<Frequency, number> = { WEEKLY: 3, MONTHLY: 6, QUARTERLY: 10, YEARLY: 14 };
const PER_YEAR: Record<Frequency, number> = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1 };

const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + Math.round(n) * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

export interface VerifyInput {
  kind: RecurringActionKind;
  frequency: Frequency;
  /** The charge amount before the action (positive cents). */
  baselineCents: Cents;
  /** When the user says they cancelled / negotiated (YYYY-MM-DD). */
  actionDate: string;
  /** Next charge expected after the action, from the recurring history. */
  nextExpected: string;
  /** Charges from this merchant on or after the action date (positive cents). */
  chargesAfter: { date: string; amountCents: Cents }[];
  /** Latest date the user's transaction data covers (most recent transaction or sync). */
  dataThrough: string | null;
  today: string;
}

export interface VerifyResult {
  status: OutcomeStatus;
  /** Money actually not paid (cancel) or the measured reduction (negotiate), to date. */
  realizedCents: Cents;
  /** Ongoing yearly effect once confirmed (cancel: full charge; negotiate: the reduction). */
  confirmedAnnualCents: Cents;
  reason: string;
  /** When VELTRIX can next decide, if still pending. */
  checkAfter: string | null;
}

export function verifyRecurringOutcome(i: VerifyInput): VerifyResult {
  // Charges dated before the action never count against it.
  const charges = i.chargesAfter.filter((c) => c.date >= i.actionDate).sort((a, b) => a.date.localeCompare(b.date));
  const due = i.nextExpected < i.actionDate ? i.actionDate : i.nextExpected;
  const deadline = addDays(due, GRACE_DAYS[i.frequency]);
  const covered = i.dataThrough !== null && i.dataThrough >= deadline;

  if (i.kind === "cancel") {
    // A charge at roughly the old price after cancelling means it didn't stop (refunds aside).
    const still = charges.find((c) => c.amountCents >= i.baselineCents * 0.5);
    if (still) return { status: "not_confirmed", realizedCents: 0, confirmedAnnualCents: 0, reason: `Charged again on ${still.date} (${(still.amountCents / 100).toFixed(2)}).`, checkAfter: null };
    if (!covered) {
      return {
        status: "pending",
        realizedCents: 0,
        confirmedAnnualCents: 0,
        reason: i.today < deadline ? `The next charge would have been around ${due}. VELTRIX checks after ${deadline}.` : `Waiting for transactions after ${deadline} to confirm. Your data currently goes through ${i.dataThrough ?? "no date"}.`,
        checkAfter: deadline,
      };
    }
    // Each expected cycle that passed without a charge is money not spent.
    const through = i.dataThrough!;
    const cyclesMissed = Math.max(1, Math.floor(daysBetween(due, through) / CYCLE_DAYS[i.frequency]) + 1);
    return {
      status: "confirmed",
      realizedCents: cyclesMissed * i.baselineCents,
      confirmedAnnualCents: i.baselineCents * PER_YEAR[i.frequency],
      reason: `No charge since ${i.actionDate}; ${cyclesMissed} expected charge${cyclesMissed === 1 ? "" : "s"} didn't happen (data through ${through}).`,
      checkAfter: null,
    };
  }

  // Negotiate / plan change: need an actual later charge to measure.
  if (!charges.length) {
    return {
      status: "pending",
      realizedCents: 0,
      confirmedAnnualCents: 0,
      reason: covered ? `No charge since ${i.actionDate} yet. If the service ended, mark it as cancelled instead.` : `Waiting for the next charge (expected around ${due}).`,
      checkAfter: covered ? null : deadline,
    };
  }
  const latest = charges[charges.length - 1];
  const reduction = i.baselineCents - latest.amountCents;
  if (reduction < Math.max(1, Math.round(i.baselineCents * 0.01))) {
    return { status: "not_confirmed", realizedCents: 0, confirmedAnnualCents: 0, reason: `The ${latest.date} charge (${(latest.amountCents / 100).toFixed(2)}) isn't lower than before (${(i.baselineCents / 100).toFixed(2)}).`, checkAfter: null };
  }
  const realized = charges.reduce((s, c) => s + Math.max(0, i.baselineCents - c.amountCents), 0);
  return {
    status: "confirmed",
    realizedCents: realized,
    confirmedAnnualCents: reduction * PER_YEAR[i.frequency],
    reason: `Charged ${(latest.amountCents / 100).toFixed(2)} on ${latest.date}, down from ${(i.baselineCents / 100).toFixed(2)}.`,
    checkAfter: null,
  };
}

/** The ledger's separate buckets. Each opportunity contributes once, in its furthest stage. */
export interface LedgerEntry {
  key: string;
  stage: "identified" | "planned" | "initiated" | "confirmed" | "not_confirmed" | "abandoned";
  estimatedAnnualCents: Cents | null;
  confirmedAnnualCents: Cents;
  realizedCents: Cents;
}

export interface LedgerTotals {
  identified: { count: number; estimatedAnnualCents: Cents };
  planned: { count: number; estimatedAnnualCents: Cents };
  initiated: { count: number; estimatedAnnualCents: Cents };
  confirmed: { count: number; confirmedAnnualCents: Cents };
  notConfirmed: { count: number };
  /** Money actually not spent so far, from confirmed outcomes only. */
  realizedCents: Cents;
}

export function ledgerTotals(entries: LedgerEntry[]): LedgerTotals {
  const byKey = new Map<string, LedgerEntry>();
  const rank = { identified: 0, planned: 1, initiated: 2, not_confirmed: 3, abandoned: 3, confirmed: 4 } as const;
  for (const e of entries) {
    const prev = byKey.get(e.key);
    if (!prev || rank[e.stage] > rank[prev.stage]) byKey.set(e.key, e);
  }
  const t: LedgerTotals = { identified: { count: 0, estimatedAnnualCents: 0 }, planned: { count: 0, estimatedAnnualCents: 0 }, initiated: { count: 0, estimatedAnnualCents: 0 }, confirmed: { count: 0, confirmedAnnualCents: 0 }, notConfirmed: { count: 0 }, realizedCents: 0 };
  for (const e of byKey.values()) {
    if (e.stage === "identified" || e.stage === "planned" || e.stage === "initiated") {
      t[e.stage].count++;
      t[e.stage].estimatedAnnualCents += e.estimatedAnnualCents ?? 0;
    } else if (e.stage === "confirmed") {
      t.confirmed.count++;
      t.confirmed.confirmedAnnualCents += e.confirmedAnnualCents;
      t.realizedCents += e.realizedCents;
    } else if (e.stage === "not_confirmed") t.notConfirmed.count++;
  }
  return t;
}
