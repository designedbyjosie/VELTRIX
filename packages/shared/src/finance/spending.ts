import { CHART_GROUPS, chartGroupFor, type ChartGroup } from "../categories";
import type { Cents } from "../money";

export interface SpendTxn {
  date: string; // YYYY-MM-DD
  amountCents: Cents; // signed: negative = outflow
  categorySlug: string | null;
  categoryKind?: "EXPENSE" | "INCOME" | "TRANSFER" | null;
}

/** An outflow that counts as spending: negative and not a transfer. */
export function isSpending(t: SpendTxn): boolean {
  return t.amountCents < 0 && t.categoryKind !== "TRANSFER" && t.categorySlug !== "transfer";
}

/** An inflow that counts as income: positive, not a transfer. */
export function isIncome(t: SpendTxn): boolean {
  return t.amountCents > 0 && t.categoryKind !== "TRANSFER" && t.categorySlug !== "transfer";
}

export interface CategorySlice {
  group: ChartGroup;
  totalCents: Cents;
  percent: number;
  count: number;
}

/** Spending by chart group, largest first. Percentages sum to ~100 (rounded to 0.1). */
export function spendingBreakdown(txns: SpendTxn[]): { totalCents: Cents; slices: CategorySlice[] } {
  const totals = new Map<ChartGroup, { total: number; count: number }>();
  for (const g of CHART_GROUPS) totals.set(g, { total: 0, count: 0 });
  let total = 0;
  for (const t of txns) {
    if (!isSpending(t)) continue;
    const g = chartGroupFor(t.categorySlug);
    const entry = totals.get(g)!;
    entry.total += -t.amountCents;
    entry.count++;
    total += -t.amountCents;
  }
  const slices = [...totals.entries()]
    .filter(([, v]) => v.total > 0)
    .map(([group, v]) => ({
      group,
      totalCents: v.total,
      count: v.count,
      percent: total === 0 ? 0 : Math.round((v.total / total) * 1000) / 10,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
  return { totalCents: total, slices };
}

/** Total spending (positive cents) for transactions. */
export function totalSpending(txns: SpendTxn[]): Cents {
  return txns.filter(isSpending).reduce((s, t) => s - t.amountCents, 0);
}

export function totalIncome(txns: SpendTxn[]): Cents {
  return txns.filter(isIncome).reduce((s, t) => s + t.amountCents, 0);
}

/** Savings rate = (income − spending) / income, as a percentage. Null when income is zero. */
export function savingsRate(incomeCents: Cents, spendingCents: Cents): number | null {
  if (incomeCents <= 0) return null;
  return Math.round(((incomeCents - spendingCents) / incomeCents) * 1000) / 10;
}

export interface MonthlyCashflow {
  month: string; // YYYY-MM
  incomeCents: Cents;
  spendingCents: Cents;
  netCents: Cents;
  savingsRate: number | null;
}

export function monthlyCashflow(txns: SpendTxn[]): MonthlyCashflow[] {
  const byMonth = new Map<string, { income: number; spending: number }>();
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    const e = byMonth.get(m) ?? { income: 0, spending: 0 };
    if (isIncome(t)) e.income += t.amountCents;
    else if (isSpending(t)) e.spending += -t.amountCents;
    byMonth.set(m, e);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, e]) => ({
      month,
      incomeCents: e.income,
      spendingCents: e.spending,
      netCents: e.income - e.spending,
      savingsRate: savingsRate(e.income, e.spending),
    }));
}

/** Categories paid as a few fixed bills per month: extrapolating a daily pace from them is meaningless. */
export const FIXED_BILL_GROUPS: readonly string[] = ["housing", "utilities"];

export interface SpikeInput {
  group: string;
  spentCents: Cents; // this month so far (positive)
  txnCount: number; // purchases in this group this month
  day: number; // day of month (1-based)
  daysInMonth: number;
  monthlyAverageCents: Cents; // average of recent full months
}

export interface SpikeResult {
  /** "actual": already spent more than usual; "pace": projected from the daily pace. */
  method: "actual" | "pace";
  projectedCents: Cents;
}

/**
 * Flags a category running well above its recent monthly average.
 * Fixed bills (rent, utilities) are judged on what's actually been spent — one rent
 * payment on the 1st must never be projected forward as if it repeated daily.
 * Variable categories use the daily pace, but only once there are enough purchases
 * (≥ 4) and enough days (≥ 7) for a pace to mean something.
 */
export function spendingSpike(i: SpikeInput): SpikeResult | null {
  const MIN_EXCESS = 5000; // $50
  if (i.monthlyAverageCents <= MIN_EXCESS) return null;
  const isSpike = (amount: Cents) => amount > i.monthlyAverageCents * 1.3 && amount - i.monthlyAverageCents > MIN_EXCESS;
  if (FIXED_BILL_GROUPS.includes(i.group)) {
    return isSpike(i.spentCents) ? { method: "actual", projectedCents: i.spentCents } : null;
  }
  if (i.day < 7 || i.txnCount < 4) return isSpike(i.spentCents) ? { method: "actual", projectedCents: i.spentCents } : null;
  const projected = Math.round((i.spentCents / i.day) * i.daysInMonth);
  return isSpike(projected) ? { method: "pace", projectedCents: projected } : null;
}
