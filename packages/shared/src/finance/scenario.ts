/**
 * Counterfactual plan engine. Deterministic month-by-month projection of cash reserves,
 * debt, investments, net worth and goal progress from a baseline and a list of changes.
 *
 * Everything here is a projection under stated assumptions, never a prediction:
 * - Month 0 is the next 30 days. Income and spending are monthly averages.
 * - Goal contributions come out of each month's surplus; a month with no surplus skips them.
 * - Debt interest is modeled only when the user has supplied an APR.
 * - Investment growth uses the case's assumed annual return (expected / best / adverse).
 * - The best / adverse cases also move discretionary spending by the variance assumption.
 */
import type { Cents } from "../money";

export interface PlanDebt {
  id: string;
  name: string;
  balanceCents: Cents;
  /** Annual interest rate in percent; null = unknown (no interest modeled). */
  aprPercent: number | null;
  monthlyPaymentCents: Cents;
}

export interface PlanGoal {
  id: string;
  name: string;
  targetCents: Cents;
  savedCents: Cents;
  monthlyCents: Cents;
  /** Month offset of the target date (0 = this month); null = no deadline. */
  targetMonth: number | null;
}

export interface PlanBaseline {
  liquidCents: Cents;
  investmentsCents: Cents;
  debts: PlanDebt[];
  monthlyIncomeCents: Cents;
  essentialCents: Cents;
  discretionaryCents: Cents;
  goals: PlanGoal[];
}

export interface PlanAssumptions {
  annualReturnPct: { best: number; expected: number; adverse: number };
  /** Discretionary spending swing for best / adverse cases, in percent. */
  spendingVariancePct: number;
  /** Months of essential spending the user wants in reserve. */
  emergencyMonths: number;
}

export const DEFAULT_ASSUMPTIONS: PlanAssumptions = {
  annualReturnPct: { best: 8, expected: 5, adverse: -10 },
  spendingVariancePct: 10,
  emergencyMonths: 3,
};

export type ScenarioChange =
  /** Positive = expense (purchase, repair, trip); negative = windfall. */
  | { kind: "one_time"; label: string; amountCents: Cents; month: number }
  /** Income change by percent and/or a fixed monthly amount, for `months` months (null = permanent). */
  | { kind: "income"; label: string; percent?: number; amountCents?: Cents; startMonth: number; months: number | null }
  | { kind: "expense"; label: string; bucket: "essential" | "discretionary"; percent?: number; amountCents?: Cents; startMonth: number; months: number | null }
  /** Save more each month (spent less on discretionary), optionally toward a specific goal. */
  | { kind: "extra_saving"; label: string; amountCents: Cents; startMonth: number; goalId?: string | null }
  | { kind: "extra_debt_payment"; label: string; amountCents: Cents; startMonth: number }
  | { kind: "financed_purchase"; label: string; amountCents: Cents; months: number; aprPercent: number; startMonth: number };

export type PlanCase = "expected" | "best" | "adverse";

export interface PlanMonth {
  month: number;
  incomeCents: Cents;
  essentialCents: Cents;
  discretionaryCents: Cents;
  financingCents: Cents;
  debtPaidCents: Cents;
  interestCents: Cents;
  oneTimeCents: Cents;
  cashflowCents: Cents;
  goalContributionCents: Cents;
  liquidCents: Cents;
  debtCents: Cents;
  investmentsCents: Cents;
  netWorthCents: Cents;
  goalSaved: Record<string, Cents>;
}

export interface PlanSummary {
  horizonMonths: number;
  endLiquidCents: Cents;
  endNetWorthCents: Cents;
  endDebtCents: Cents;
  lowestLiquid: { cents: Cents; month: number };
  firstNegativeMonth: number | null;
  /** Month the debt reaches zero; null if not within the horizon (or no debt: 0). */
  debtFreeMonth: number | null;
  totalInterestCents: Cents;
  averageCashflowCents: Cents;
  /** Reserves at the end divided by monthly essential spending. */
  endReserveMonths: number | null;
  goals: { id: string; name: string; completionMonth: number | null; targetMonth: number | null; onTrack: boolean | null; endSavedCents: Cents }[];
}

export interface PlanResult {
  months: PlanMonth[];
  summary: PlanSummary;
}

const round = (n: number) => Math.round(n);

function active(start: number, months: number | null | undefined, m: number) {
  return m >= start && (months === null || months === undefined || m < start + months);
}

/** Level monthly payment for an amortized loan. */
export function amortizedPayment(principalCents: Cents, months: number, aprPercent: number): Cents {
  if (months <= 0) return principalCents;
  const r = aprPercent / 100 / 12;
  if (r === 0) return Math.ceil(principalCents / months);
  return Math.ceil((principalCents * r) / (1 - Math.pow(1 + r, -months)));
}

export function simulatePlan(baseline: PlanBaseline, changes: ScenarioChange[], horizonMonths: number, assumptions: PlanAssumptions = DEFAULT_ASSUMPTIONS, planCase: PlanCase = "expected"): PlanResult {
  const horizon = Math.max(1, Math.min(120, Math.floor(horizonMonths)));
  const monthlyReturn = Math.pow(1 + assumptions.annualReturnPct[planCase] / 100, 1 / 12) - 1;
  const discMultiplier = planCase === "best" ? 1 - assumptions.spendingVariancePct / 100 : planCase === "adverse" ? 1 + assumptions.spendingVariancePct / 100 : 1;

  let liquid = baseline.liquidCents;
  let investments = baseline.investmentsCents;
  const debts = baseline.debts.map((d) => ({ ...d }));
  const goals = baseline.goals.map((g) => ({ ...g, saved: g.savedCents, completionMonth: g.savedCents >= g.targetCents ? 0 : (null as number | null) }));
  const financed = changes
    .filter((c): c is Extract<ScenarioChange, { kind: "financed_purchase" }> => c.kind === "financed_purchase")
    .map((c) => ({ ...c, payment: amortizedPayment(c.amountCents, c.months, c.aprPercent) }));

  const months: PlanMonth[] = [];
  let totalInterest = 0;
  let debtFreeMonth: number | null = debts.every((d) => d.balanceCents <= 0) ? 0 : null;

  for (let m = 0; m < horizon; m++) {
    // Income
    let incomePct = 0;
    let incomeAmt = 0;
    for (const c of changes) if (c.kind === "income" && active(c.startMonth, c.months, m)) {
      incomePct += c.percent ?? 0;
      incomeAmt += c.amountCents ?? 0;
    }
    const income = Math.max(0, round(baseline.monthlyIncomeCents * (1 + incomePct / 100) + incomeAmt));

    // Spending
    const bucket = { essential: { pct: 0, amt: 0 }, discretionary: { pct: 0, amt: 0 } };
    let extraSaving = 0;
    const extraSavingByGoal = new Map<string | null, number>();
    let extraDebt = 0;
    let oneTime = 0;
    for (const c of changes) {
      if (c.kind === "expense" && active(c.startMonth, c.months, m)) {
        bucket[c.bucket].pct += c.percent ?? 0;
        bucket[c.bucket].amt += c.amountCents ?? 0;
      } else if (c.kind === "extra_saving" && m >= c.startMonth) {
        extraSaving += c.amountCents;
        extraSavingByGoal.set(c.goalId ?? null, (extraSavingByGoal.get(c.goalId ?? null) ?? 0) + c.amountCents);
      } else if (c.kind === "extra_debt_payment" && m >= c.startMonth) extraDebt += c.amountCents;
      else if (c.kind === "one_time" && c.month === m) oneTime += c.amountCents;
    }
    const essential = Math.max(0, round(baseline.essentialCents * (1 + bucket.essential.pct / 100) + bucket.essential.amt));
    const discretionaryBefore = Math.max(0, round((baseline.discretionaryCents * (1 + bucket.discretionary.pct / 100) + bucket.discretionary.amt) * discMultiplier));
    // Extra saving is money not spent; it can't cut spending below zero.
    const savedFromSpending = Math.min(extraSaving, discretionaryBefore);
    const discretionary = discretionaryBefore - savedFromSpending;

    let financing = 0;
    for (const f of financed) if (m >= f.startMonth && m < f.startMonth + f.months) financing += f.payment;
    const financingInterest = financed.reduce((s, f) => s + (m >= f.startMonth && m < f.startMonth + f.months ? f.payment - f.amountCents / f.months : 0), 0);

    // Debt: interest, scheduled payments, then extra payments (highest known APR first)
    let interest = 0;
    let debtPaid = 0;
    for (const d of debts) {
      if (d.balanceCents <= 0) continue;
      const i = d.aprPercent ? round((d.balanceCents * d.aprPercent) / 100 / 12) : 0;
      d.balanceCents += i;
      interest += i;
      const pay = Math.min(d.balanceCents, d.monthlyPaymentCents);
      d.balanceCents -= pay;
      debtPaid += pay;
    }
    let extraLeft = extraDebt;
    for (const d of [...debts].sort((a, b) => (b.aprPercent ?? -1) - (a.aprPercent ?? -1))) {
      if (extraLeft <= 0) break;
      const pay = Math.min(d.balanceCents, extraLeft);
      d.balanceCents -= pay;
      debtPaid += pay;
      extraLeft -= pay;
    }
    totalInterest += interest + Math.max(0, round(financingInterest));
    const debtTotal = debts.reduce((s, d) => s + Math.max(0, d.balanceCents), 0);
    if (debtFreeMonth === null && debtTotal <= 0) debtFreeMonth = m;

    const cashflow = income - essential - discretionary - financing - debtPaid - oneTime;

    // Goal contributions from this month's surplus (planned amount + extra saving)
    const open = goals.filter((g) => g.saved < g.targetCents);
    const planned = new Map<string, number>();
    for (const g of open) planned.set(g.id, g.monthlyCents);
    for (const [goalId, amt] of extraSavingByGoal) {
      const target = goalId ? open.find((g) => g.id === goalId) : open[0];
      if (target) planned.set(target.id, (planned.get(target.id) ?? 0) + amt);
    }
    const plannedTotal = [...planned.values()].reduce((a, b) => a + b, 0);
    // The extra saving already lowered spending, so it's part of this surplus.
    const available = Math.max(0, cashflow);
    const scale = plannedTotal > 0 ? Math.min(1, available / plannedTotal) : 0;
    let contributed = 0;
    for (const g of open) {
      const c = Math.min(g.targetCents - g.saved, round((planned.get(g.id) ?? 0) * scale));
      g.saved += c;
      contributed += c;
      if (g.completionMonth === null && g.saved >= g.targetCents) g.completionMonth = m;
    }

    liquid += cashflow;
    investments = round(investments * (1 + monthlyReturn));
    months.push({
      month: m,
      incomeCents: income,
      essentialCents: essential,
      discretionaryCents: discretionary,
      financingCents: financing,
      debtPaidCents: debtPaid,
      interestCents: interest,
      oneTimeCents: oneTime,
      cashflowCents: cashflow,
      goalContributionCents: contributed,
      liquidCents: liquid,
      debtCents: debtTotal,
      investmentsCents: investments,
      netWorthCents: liquid + investments - debtTotal,
      goalSaved: Object.fromEntries(goals.map((g) => [g.id, g.saved])),
    });
  }

  const lowest = months.reduce((lo, x) => (x.liquidCents < lo.cents ? { cents: x.liquidCents, month: x.month } : lo), { cents: months[0].liquidCents, month: 0 });
  const last = months[months.length - 1];
  const essentialNow = baseline.essentialCents;
  return {
    months,
    summary: {
      horizonMonths: horizon,
      endLiquidCents: last.liquidCents,
      endNetWorthCents: last.netWorthCents,
      endDebtCents: last.debtCents,
      lowestLiquid: lowest,
      firstNegativeMonth: months.find((x) => x.liquidCents < 0)?.month ?? null,
      debtFreeMonth,
      totalInterestCents: totalInterest,
      averageCashflowCents: round(months.reduce((s, x) => s + x.cashflowCents, 0) / months.length),
      endReserveMonths: essentialNow > 0 ? Math.round((last.liquidCents / essentialNow) * 10) / 10 : null,
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        completionMonth: g.completionMonth,
        targetMonth: g.targetMonth,
        onTrack: g.targetMonth === null ? null : g.completionMonth !== null && g.completionMonth <= g.targetMonth,
        endSavedCents: g.saved,
      })),
    },
  };
}

export interface PlanComparison {
  endNetWorthDeltaCents: Cents;
  endLiquidDeltaCents: Cents;
  lowestLiquidDeltaCents: Cents;
  interestDeltaCents: Cents;
  /** Months later (+) or earlier (−) each goal completes; null when either side doesn't finish in the horizon. */
  goalDelays: { id: string; name: string; delayMonths: number | null; becameOffTrack: boolean; baselineMonth: number | null; scenarioMonth: number | null }[];
  newlyNegative: boolean;
}

export function comparePlans(base: PlanSummary, alt: PlanSummary): PlanComparison {
  return {
    endNetWorthDeltaCents: alt.endNetWorthCents - base.endNetWorthCents,
    endLiquidDeltaCents: alt.endLiquidCents - base.endLiquidCents,
    lowestLiquidDeltaCents: alt.lowestLiquid.cents - base.lowestLiquid.cents,
    interestDeltaCents: alt.totalInterestCents - base.totalInterestCents,
    goalDelays: base.goals.map((g) => {
      const a = alt.goals.find((x) => x.id === g.id)!;
      return {
        id: g.id,
        name: g.name,
        baselineMonth: g.completionMonth,
        scenarioMonth: a.completionMonth,
        delayMonths: g.completionMonth !== null && a.completionMonth !== null ? a.completionMonth - g.completionMonth : null,
        becameOffTrack: g.onTrack === true && a.onTrack === false,
      };
    }),
    newlyNegative: base.firstNegativeMonth === null && alt.firstNegativeMonth !== null,
  };
}

/** How much each change, applied alone, moves end net worth and the lowest reserve point. */
export function scenarioDrivers(baseline: PlanBaseline, changes: ScenarioChange[], horizon: number, assumptions: PlanAssumptions = DEFAULT_ASSUMPTIONS) {
  const base = simulatePlan(baseline, [], horizon, assumptions).summary;
  return changes
    .map((c, index) => {
      const s = simulatePlan(baseline, [c], horizon, assumptions).summary;
      return { index, label: c.label, endNetWorthDeltaCents: s.endNetWorthCents - base.endNetWorthCents, lowestLiquidDeltaCents: s.lowestLiquid.cents - base.lowestLiquid.cents };
    })
    .sort((a, b) => Math.abs(b.endNetWorthDeltaCents) - Math.abs(a.endNetWorthDeltaCents));
}

/** Expected plus best/adverse range for a set of changes. */
export function runScenario(baseline: PlanBaseline, changes: ScenarioChange[], horizon: number, assumptions: PlanAssumptions = DEFAULT_ASSUMPTIONS) {
  const expected = simulatePlan(baseline, changes, horizon, assumptions, "expected");
  const best = simulatePlan(baseline, changes, horizon, assumptions, "best");
  const adverse = simulatePlan(baseline, changes, horizon, assumptions, "adverse");
  return { expected, best: best.summary, adverse: adverse.summary, bestMonths: best.months.map((m) => m.liquidCents), adverseMonths: adverse.months.map((m) => m.liquidCents) };
}

// ---------------------------------------------------------------- Stress test

export interface StressInput {
  /** Months of lost income starting now (0 = none). */
  incomeLossMonths: number;
  /** Share of income still received during the loss (e.g. unemployment benefits), 0–100. */
  incomeReplacementPct: number;
  /** One-time unexpected cost now (repair, medical bill…). */
  emergencyCostCents: Cents;
  /** Monthly increase in essential costs (e.g. rent), permanent. */
  essentialIncreaseCents: Cents;
  /** Percent cut to discretionary spending during the stress period (what the user would do). */
  discretionaryCutPct: number;
}

export function stressChanges(i: StressInput): ScenarioChange[] {
  const out: ScenarioChange[] = [];
  if (i.incomeLossMonths > 0) out.push({ kind: "income", label: `Income loss for ${i.incomeLossMonths} month${i.incomeLossMonths === 1 ? "" : "s"}`, percent: -(100 - i.incomeReplacementPct), startMonth: 0, months: i.incomeLossMonths });
  if (i.emergencyCostCents > 0) out.push({ kind: "one_time", label: "Unexpected expense", amountCents: i.emergencyCostCents, month: 0 });
  if (i.essentialIncreaseCents > 0) out.push({ kind: "expense", label: "Higher essential costs", bucket: "essential", amountCents: i.essentialIncreaseCents, startMonth: 0, months: null });
  if (i.discretionaryCutPct > 0) out.push({ kind: "expense", label: `Cut discretionary spending ${i.discretionaryCutPct}%`, bucket: "discretionary", percent: -i.discretionaryCutPct, startMonth: 0, months: i.incomeLossMonths > 0 ? i.incomeLossMonths : null });
  return out;
}

/** Months current reserves would cover essential spending with no income at all. */
export function reserveRunwayMonths(liquidCents: Cents, monthlyEssentialCents: Cents): number | null {
  if (monthlyEssentialCents <= 0) return null;
  return Math.max(0, Math.round((liquidCents / monthlyEssentialCents) * 10) / 10);
}

export interface PreparationStep {
  title: string;
  detail: string;
  impactCents: Cents | null;
}

/** Practical, prioritized steps from a stress result. Deterministic, based only on the user's numbers. */
export function preparationSteps(baseline: PlanBaseline, stressed: PlanSummary, assumptions: PlanAssumptions, recurringMonthlyCents: Cents): PreparationStep[] {
  const steps: PreparationStep[] = [];
  const target = baseline.essentialCents * assumptions.emergencyMonths;
  const gap = target - baseline.liquidCents;
  if (gap > 0) {
    steps.push({
      title: `Build reserves toward ${assumptions.emergencyMonths} months of essentials`,
      detail: `Your target is ${assumptions.emergencyMonths} × your essential spending. You're short by this amount; setting aside about 1/12 of it a month closes the gap in a year.`,
      impactCents: gap,
    });
  }
  if (stressed.firstNegativeMonth !== null && baseline.discretionaryCents > 0) {
    steps.push({
      title: "Know which spending you'd pause first",
      detail: "In this scenario reserves run out. Decide now which discretionary costs you would pause; every dollar of discretionary spending you cut extends how long reserves last.",
      impactCents: baseline.discretionaryCents,
    });
  }
  if (recurringMonthlyCents > 0) {
    steps.push({ title: "Review recurring charges", detail: "Recurring charges continue during a hard month. Confirm which ones you'd keep.", impactCents: recurringMonthlyCents });
  }
  if (baseline.debts.some((d) => d.aprPercent === null && d.balanceCents > 0)) {
    steps.push({ title: "Add your debt interest rates", detail: "Without APRs, interest isn't modeled, so the true cost of carrying debt through a hard period is understated.", impactCents: null });
  }
  if (!steps.length) steps.push({ title: "You're covered in this scenario", detail: "Reserves stay positive throughout. Re-run the test when your income or costs change.", impactCents: null });
  return steps;
}
