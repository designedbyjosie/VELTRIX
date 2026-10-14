import type { Cents } from "../money";

export interface GoalInput {
  targetCents: Cents;
  savedCents: Cents;
  targetDate: string | null; // YYYY-MM-DD
  plannedMonthlyCents: Cents | null;
  /** Today's date (YYYY-MM-DD), injected for deterministic tests. */
  today: string;
}

export interface GoalProjection {
  percent: number;
  remainingCents: Cents;
  monthsLeft: number | null; // until target date
  requiredMonthlyCents: Cents | null; // to hit target date
  projectedCompletion: string | null; // YYYY-MM at planned pace
  onTrack: boolean | null;
  assumptions: string[];
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return months;
}

function addMonths(date: string, n: number): string {
  const [y, m] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Deterministic goal projection. Assumes contributions continue at the planned
 * monthly amount with no investment growth, so results are conservative and
 * easy to verify by hand.
 */
export function projectGoal(g: GoalInput): GoalProjection {
  const remaining = Math.max(0, g.targetCents - g.savedCents);
  const percent = g.targetCents <= 0 ? 0 : Math.min(100, Math.round((g.savedCents / g.targetCents) * 1000) / 10);
  const assumptions = ["No interest or investment growth is assumed.", "Contributions are assumed to continue at the planned monthly amount."];

  let monthsLeft: number | null = null;
  let required: Cents | null = null;
  if (g.targetDate) {
    monthsLeft = Math.max(0, monthsBetween(g.today, g.targetDate));
    required = remaining === 0 ? 0 : monthsLeft === 0 ? remaining : Math.ceil(remaining / monthsLeft);
  }

  let projected: string | null = null;
  if (remaining === 0) projected = g.today.slice(0, 7);
  else if (g.plannedMonthlyCents && g.plannedMonthlyCents > 0) {
    projected = addMonths(g.today, Math.ceil(remaining / g.plannedMonthlyCents));
  }

  let onTrack: boolean | null = null;
  if (remaining === 0) onTrack = true;
  else if (required !== null && g.plannedMonthlyCents !== null) onTrack = g.plannedMonthlyCents >= required;

  return { percent, remainingCents: remaining, monthsLeft, requiredMonthlyCents: required, projectedCompletion: projected, onTrack, assumptions };
}

/** Emergency fund target: months of essential expenses (default 6). */
export function emergencyFundTarget(monthlyEssentialCents: Cents, months = 6): Cents {
  return monthlyEssentialCents * months;
}
