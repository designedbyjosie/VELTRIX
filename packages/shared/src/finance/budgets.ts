import type { Cents } from "../money";

export type BudgetHealth = "ok" | "warning" | "over";

export interface BudgetLineInput {
  categoryId: string;
  limitCents: Cents;
  spentCents: Cents;
  /** Percentage of the limit at which the user is warned (e.g. 80). */
  alertThreshold: number;
}

export interface BudgetLineStatus extends BudgetLineInput {
  remainingCents: Cents;
  percentUsed: number;
  health: BudgetHealth;
}

export function budgetLineStatus(line: BudgetLineInput): BudgetLineStatus {
  const percentUsed = line.limitCents <= 0 ? (line.spentCents > 0 ? 100 : 0) : (line.spentCents / line.limitCents) * 100;
  let health: BudgetHealth = "ok";
  if (line.spentCents > line.limitCents) health = "over";
  else if (percentUsed >= line.alertThreshold) health = "warning";
  return {
    ...line,
    remainingCents: line.limitCents - line.spentCents,
    percentUsed: Math.round(percentUsed * 10) / 10,
    health,
  };
}

export interface BudgetSummary {
  limitCents: Cents;
  spentCents: Cents;
  remainingCents: Cents;
  percentUsed: number;
  overCount: number;
  warningCount: number;
  lines: BudgetLineStatus[];
}

export function summarizeBudget(lines: BudgetLineInput[]): BudgetSummary {
  const statuses = lines.map(budgetLineStatus);
  const limit = statuses.reduce((s, l) => s + l.limitCents, 0);
  const spent = statuses.reduce((s, l) => s + l.spentCents, 0);
  return {
    limitCents: limit,
    spentCents: spent,
    remainingCents: limit - spent,
    percentUsed: limit === 0 ? 0 : Math.round((spent / limit) * 1000) / 10,
    overCount: statuses.filter((s) => s.health === "over").length,
    warningCount: statuses.filter((s) => s.health === "warning").length,
    lines: statuses,
  };
}

/**
 * Projected month-end spending assuming the current daily pace continues.
 * Clearly an estimate: pace-based, ignores known upcoming bills.
 */
export function projectMonthEnd(spentCents: Cents, dayOfMonth: number, daysInMonth: number): Cents {
  if (dayOfMonth <= 0) return spentCents;
  return Math.round((spentCents / dayOfMonth) * daysInMonth);
}
