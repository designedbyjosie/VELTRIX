import { describe, expect, it } from "vitest";
import { amortizedPayment, comparePlans, evaluatePurchase, preparationSteps, reserveRunwayMonths, runScenario, scenarioDrivers, simulatePlan, stressChanges, type PlanBaseline, DEFAULT_ASSUMPTIONS } from "../src";

const flat = { ...DEFAULT_ASSUMPTIONS, annualReturnPct: { best: 0, expected: 0, adverse: 0 } };
const base: PlanBaseline = {
  liquidCents: 1_000_000, // $10,000
  investmentsCents: 0,
  debts: [],
  monthlyIncomeCents: 500_000, // $5,000
  essentialCents: 250_000, // $2,500
  discretionaryCents: 150_000, // $1,500
  goals: [{ id: "g", name: "Emergency fund", targetCents: 600_000, savedCents: 0, monthlyCents: 50_000, targetMonth: 13 }],
};
const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

describe("plan engine", () => {
  it("projects reserves and goal progress month by month", () => {
    const r = simulatePlan(base, [], 12, flat);
    // $1,000 surplus a month → +$12,000 after 12 months
    expect(r.summary.endLiquidCents).toBe(2_200_000);
    expect(r.months[0].goalContributionCents).toBe(50_000);
    // $6,000 at $500/month → completes in month index 11
    expect(r.summary.goals[0]).toMatchObject({ completionMonth: 11, onTrack: true });
    expect(r.summary.firstNegativeMonth).toBeNull();
  });

  it("a one-time purchase skips that month's goal contribution and delays the goal", () => {
    const b = simulatePlan(base, [], 24, flat).summary;
    const s = simulatePlan(base, [{ kind: "one_time", label: "Laptop", amountCents: 150_000, month: 0 }], 24, flat).summary;
    const cmp = comparePlans(b, s);
    expect(cmp.endLiquidDeltaCents).toBe(-150_000);
    expect(cmp.goalDelays[0].delayMonths).toBe(1);
  });

  it("income loss drains reserves and can go negative", () => {
    const r = simulatePlan(base, [{ kind: "income", label: "Job loss", percent: -100, startMonth: 0, months: 3 }], 6, flat);
    expect(r.months[0].incomeCents).toBe(0);
    expect(r.months[3].incomeCents).toBe(500_000);
    expect(r.summary.lowestLiquid).toEqual({ cents: 1_000_000 - 3 * 400_000, month: 2 });
    expect(r.summary.firstNegativeMonth).toBe(2);
  });

  it("extra saving comes out of discretionary spending and speeds up the goal", () => {
    const s = simulatePlan(base, [{ kind: "extra_saving", label: "Save more", amountCents: 50_000, startMonth: 0, goalId: "g" }], 12, flat).summary;
    expect(s.goals[0].completionMonth).toBe(5); // $1,000/month → 6 months
    expect(s.endLiquidCents).toBe(2_200_000 + 12 * 50_000);
  });

  it("models debt interest only when an APR is known, and extra payments shorten payoff", () => {
    const withDebt = { ...base, debts: [{ id: "cc", name: "Card", balanceCents: 300_000, aprPercent: 24, monthlyPaymentCents: 20_000 }] };
    const slow = simulatePlan(withDebt, [], 36, flat).summary;
    const fast = simulatePlan(withDebt, [{ kind: "extra_debt_payment", label: "Extra $200", amountCents: 20_000, startMonth: 0 }], 36, flat).summary;
    expect(slow.totalInterestCents).toBeGreaterThan(0);
    expect(fast.debtFreeMonth!).toBeLessThan(slow.debtFreeMonth ?? 99);
    expect(fast.totalInterestCents).toBeLessThan(slow.totalInterestCents);
    const unknownApr = simulatePlan({ ...withDebt, debts: [{ ...withDebt.debts[0], aprPercent: null }] }, [], 12, flat).summary;
    expect(unknownApr.totalInterestCents).toBe(0);
  });

  it("financed purchases use a level amortized payment", () => {
    expect(amortizedPayment(120_000, 12, 0)).toBe(10_000);
    expect(amortizedPayment(100_000, 12, 12)).toBe(8885); // $1,000 at 12% over 12 months ≈ $88.85
  });

  it("gives best/expected/adverse ranges and ranks drivers", () => {
    const r = runScenario(base, [], 12, DEFAULT_ASSUMPTIONS);
    expect(r.best.endLiquidCents).toBeGreaterThan(r.expected.summary.endLiquidCents);
    expect(r.adverse.endLiquidCents).toBeLessThan(r.expected.summary.endLiquidCents);
    const d = scenarioDrivers(base, [{ kind: "one_time", label: "Small", amountCents: 10_000, month: 0 }, { kind: "income", label: "Raise", percent: 10, startMonth: 0, months: null }], 12, flat);
    expect(d[0].label).toBe("Raise");
    expect(d[0].endNetWorthDeltaCents).toBe(12 * 50_000);
  });
});

describe("stress test", () => {
  it("builds changes and preparation steps from the user's numbers", () => {
    const changes = stressChanges({ incomeLossMonths: 4, incomeReplacementPct: 0, emergencyCostCents: 200_000, essentialIncreaseCents: 0, discretionaryCutPct: 50 });
    expect(changes.map((c) => c.kind)).toEqual(["income", "one_time", "expense"]);
    const r = simulatePlan(base, changes, 12, flat).summary;
    expect(r.firstNegativeMonth).toBe(2);
    expect(reserveRunwayMonths(base.liquidCents, base.essentialCents)).toBe(4);
    const steps = preparationSteps(base, r, { ...flat, emergencyMonths: 6 }, 3_000);
    expect(steps[0].title).toMatch(/Build reserves/);
    expect(steps.some((s) => /pause first/.test(s.title))).toBe(true);
  });
});

describe("purchase decision", () => {
  it("fits when goals stay on schedule and cash stays healthy", () => {
    const rich = { ...base, liquidCents: 5_000_000 };
    const d = evaluatePurchase(rich, flat, { label: "Headphones", priceCents: 20_000 }, fmt);
    expect(d.verdict).toBe("fits");
    expect(d.options.map((o) => o.key)).toEqual(["buy_now", "buy_later", "skip"]);
  });

  it("suggests alternatives when a goal slips or a cheaper option exists", () => {
    const d = evaluatePurchase(base, flat, { label: "Laptop", priceCents: 150_000, alternative: { label: "Refurbished laptop", priceCents: 100_000, verified: false } }, fmt);
    expect(d.verdict).toBe("consider");
    expect(d.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(["goal_delayed", "cheaper_option"]));
    expect(d.monthsToSaveFor).toBe(3); // $1,500 / $500 surplus after goal saving
  });

  it("flags a goal at risk when cash would fall under one month of essentials", () => {
    const d = evaluatePurchase(base, flat, { label: "Sofa", priceCents: 800_000 }, fmt);
    expect(d.verdict).toBe("risk");
    expect(d.reasons[0].code).toBe("below_one_month");
  });

  it("prices financing and says when the projection is limited", () => {
    const d = evaluatePurchase({ ...base, monthlyIncomeCents: 0, essentialCents: 0, discretionaryCents: 0 }, flat, { label: "Phone", priceCents: 100_000, financing: { months: 12, aprPercent: 20 } }, fmt);
    expect(d.confidence).toBe("limited");
    expect(d.missing).toEqual(["monthly income", "monthly spending"]);
    expect(d.reasons.map((r) => r.code)).toContain("financing_cost");
  });
});
