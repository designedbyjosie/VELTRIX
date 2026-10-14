/**
 * "Think before you spend": compares buying now with buying later, a cheaper option,
 * financing and skipping, using the same plan engine and assumptions for each. The
 * verdict comes only from explicit rules over those numbers; every reason carries the
 * figures behind it. It describes trade-offs, not judgments about what to buy.
 */
import type { Cents } from "../money";
import { comparePlans, runScenario, type PlanAssumptions, type PlanBaseline, type PlanComparison, type PlanSummary, type ScenarioChange } from "./scenario";

export type DecisionVerdict = "fits" | "consider" | "risk";

export interface PurchaseInput {
  label: string;
  priceCents: Cents;
  /** Remaining budget in the purchase's category this month, if a budget exists. */
  categoryRemainingCents?: Cents | null;
  /** Financing offer, if the user is considering one. */
  financing?: { months: number; aprPercent: number } | null;
  /** A cheaper equivalent the user found (or VELTRIX verified). */
  alternative?: { label: string; priceCents: Cents; verified: boolean } | null;
  /** Months to wait for the "buy later" option. */
  waitMonths?: number;
  /** Expected uses per month, for cost-per-use. */
  usesPerMonth?: number | null;
  horizonMonths?: number;
}

export interface DecisionReason {
  code: string;
  severity: DecisionVerdict;
  text: string;
}

export interface DecisionOption {
  key: "buy_now" | "buy_later" | "alternative" | "financed" | "skip";
  label: string;
  changes: ScenarioChange[];
  summary: PlanSummary;
  adverse: PlanSummary;
  vsSkip: PlanComparison;
}

export interface PurchaseDecision {
  verdict: DecisionVerdict;
  /** "limited" when income or spending is unknown, so cash flow couldn't be projected. */
  confidence: "normal" | "limited";
  reasons: DecisionReason[];
  options: DecisionOption[];
  missing: string[];
  costPerUseCents: Cents | null;
  /** Months of surplus needed to cover the price without touching reserves. */
  monthsToSaveFor: number | null;
}

export function evaluatePurchase(baseline: PlanBaseline, assumptions: PlanAssumptions, input: PurchaseInput, fmt: (c: Cents) => string): PurchaseDecision {
  const horizon = input.horizonMonths ?? 24;
  const missing: string[] = [];
  if (baseline.monthlyIncomeCents <= 0) missing.push("monthly income");
  if (baseline.essentialCents + baseline.discretionaryCents <= 0) missing.push("monthly spending");
  const confidence = missing.length ? "limited" : "normal";

  const surplus = baseline.monthlyIncomeCents - baseline.essentialCents - baseline.discretionaryCents - baseline.debts.reduce((s, d) => s + d.monthlyPaymentCents, 0) - baseline.goals.reduce((s, g) => s + (g.savedCents < g.targetCents ? g.monthlyCents : 0), 0);
  const monthsToSaveFor = surplus > 0 ? Math.ceil(input.priceCents / surplus) : null;
  const wait = Math.max(1, Math.min(24, input.waitMonths ?? Math.min(12, monthsToSaveFor ?? 3)));

  const skip = runScenario(baseline, [], horizon, assumptions);
  const option = (key: DecisionOption["key"], label: string, changes: ScenarioChange[]): DecisionOption => {
    const r = runScenario(baseline, changes, horizon, assumptions);
    return { key, label, changes, summary: r.expected.summary, adverse: r.adverse, vsSkip: comparePlans(skip.expected.summary, r.expected.summary) };
  };
  const options: DecisionOption[] = [option("buy_now", "Buy now", [{ kind: "one_time", label: input.label, amountCents: input.priceCents, month: 0 }])];
  options.push(option("buy_later", `Buy in ${wait} month${wait === 1 ? "" : "s"}`, [{ kind: "one_time", label: input.label, amountCents: input.priceCents, month: wait }]));
  if (input.alternative && input.alternative.priceCents < input.priceCents) {
    options.push(option("alternative", `${input.alternative.label}${input.alternative.verified ? "" : " (price you entered)"}`, [{ kind: "one_time", label: input.alternative.label, amountCents: input.alternative.priceCents, month: 0 }]));
  }
  if (input.financing && input.financing.months > 0) {
    options.push(option("financed", `Finance over ${input.financing.months} months at ${input.financing.aprPercent}% APR`, [{ kind: "financed_purchase", label: input.label, amountCents: input.priceCents, months: input.financing.months, aprPercent: input.financing.aprPercent, startMonth: 0 }]));
  }
  options.push({ key: "skip", label: "Skip it", changes: [], summary: skip.expected.summary, adverse: skip.adverse, vsSkip: comparePlans(skip.expected.summary, skip.expected.summary) });

  const now = options[0];
  const reasons: DecisionReason[] = [];
  const oneMonthEssential = baseline.essentialCents;
  const reserveAfter = baseline.liquidCents - input.priceCents;

  // Goal at risk
  if (now.vsSkip.newlyNegative) reasons.push({ code: "reserves_negative", severity: "risk", text: `Projected reserves would fall below zero in month ${now.summary.firstNegativeMonth! + 1}, which they don't without this purchase.` });
  if (reserveAfter < 0) reasons.push({ code: "exceeds_reserves", severity: "risk", text: `The price (${fmt(input.priceCents)}) is more than your available cash today (${fmt(baseline.liquidCents)}).` });
  else if (oneMonthEssential > 0 && reserveAfter < oneMonthEssential) reasons.push({ code: "below_one_month", severity: "risk", text: `After buying, cash would be ${fmt(reserveAfter)}, less than one month of essential spending (${fmt(oneMonthEssential)}).` });
  for (const g of now.vsSkip.goalDelays) if (g.becameOffTrack) reasons.push({ code: "goal_off_track", severity: "risk", text: `"${g.name}" would no longer be reached by its target date.` });

  // Consider alternatives
  for (const g of now.vsSkip.goalDelays) {
    if (g.becameOffTrack) continue;
    if (g.delayMonths !== null && g.delayMonths >= 1) reasons.push({ code: "goal_delayed", severity: "consider", text: `"${g.name}" would be reached about ${g.delayMonths} month${g.delayMonths === 1 ? "" : "s"} later.` });
    else if (g.delayMonths === null && g.endSavedDeltaCents < 0) reasons.push({ code: "goal_slower", severity: "consider", text: `"${g.name}" would have ${fmt(-g.endSavedDeltaCents)} less saved by the end of the ${horizon}-month plan.` });
  }
  if (input.categoryRemainingCents !== undefined && input.categoryRemainingCents !== null && input.priceCents > input.categoryRemainingCents) {
    reasons.push({ code: "over_category_budget", severity: "consider", text: `It's more than what's left in this category's budget this month (${fmt(Math.max(0, input.categoryRemainingCents))}).` });
  }
  const target = oneMonthEssential * assumptions.emergencyMonths;
  if (target > 0 && reserveAfter >= oneMonthEssential && reserveAfter < target && baseline.liquidCents >= target) {
    reasons.push({ code: "below_reserve_target", severity: "consider", text: `Cash would drop below your ${assumptions.emergencyMonths}-month reserve target (${fmt(target)}).` });
  }
  const financed = options.find((o) => o.key === "financed");
  if (financed && financed.vsSkip.interestDeltaCents > 0) reasons.push({ code: "financing_cost", severity: "consider", text: `Financing adds about ${fmt(financed.vsSkip.interestDeltaCents)} in interest.` });
  const alt = options.find((o) => o.key === "alternative");
  if (alt && input.alternative && input.alternative.priceCents <= input.priceCents * 0.9) {
    reasons.push({ code: "cheaper_option", severity: "consider", text: `${input.alternative.label} costs ${fmt(input.priceCents - input.alternative.priceCents)} less${input.alternative.verified ? " (verified price)" : ""}.` });
  }
  if (!now.vsSkip.newlyNegative && now.adverse.firstNegativeMonth !== null && skip.adverse.firstNegativeMonth === null) {
    reasons.push({ code: "adverse_negative", severity: "consider", text: "If spending runs higher than usual, reserves could dip below zero within the plan period." });
  }

  // Fits
  if (!reasons.length) {
    reasons.push({ code: "fits", severity: "fits", text: confidence === "normal" ? `Your goals stay on schedule and cash stays above one month of essentials (${fmt(reserveAfter)} left after buying).` : `You'd have ${fmt(reserveAfter)} in cash afterwards. Add your income and spending for a full projection.` });
  }

  const verdict: DecisionVerdict = reasons.some((r) => r.severity === "risk") ? "risk" : reasons.some((r) => r.severity === "consider") ? "consider" : "fits";
  const costPerUseCents = input.usesPerMonth && input.usesPerMonth > 0 ? Math.round(input.priceCents / (input.usesPerMonth * 12)) : null;
  return { verdict, confidence, reasons, options, missing, costPerUseCents, monthsToSaveFor };
}
