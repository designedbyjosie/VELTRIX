import { describe, expect, it } from "vitest";
import {
  budgetLineStatus,
  calculateNetWorth,
  detectRecurring,
  monthlyCashflow,
  portfolioPerformance,
  projectGoal,
  projectMonthEnd,
  savingsRate,
  spendingBreakdown,
  spendingSpike,
  summarizeBudget,
  summarizePortfolio,
} from "../src/finance";
import { categorize, merchantKey } from "../src/categories";

describe("net worth", () => {
  it("subtracts liabilities from assets instead of summing balances", () => {
    const r = calculateNetWorth([
      { type: "CHECKING", balanceCents: 500000, currency: "USD" },
      { type: "INVESTMENT", balanceCents: 2000000, currency: "USD" },
      { type: "CREDIT_CARD", balanceCents: 120000, currency: "USD" },
      { type: "MORTGAGE", balanceCents: 10000000, currency: "USD" },
      { type: "PROPERTY", balanceCents: 15000000, currency: "USD" },
    ]);
    expect(r.assetsCents).toBe(17500000);
    expect(r.liabilitiesCents).toBe(10120000);
    expect(r.netWorthCents).toBe(7380000);
    expect(r.liquidCents).toBe(500000);
    expect(r.investmentsCents).toBe(2000000);
  });
  it("excludes foreign-currency accounts rather than guessing an FX rate", () => {
    const r = calculateNetWorth([
      { type: "CHECKING", balanceCents: 1000, currency: "USD" },
      { type: "SAVINGS", balanceCents: 999999, currency: "EUR" },
    ]);
    expect(r.netWorthCents).toBe(1000);
    expect(r.excludedForeignCurrency).toBe(1);
  });
  it("can be negative", () => {
    expect(calculateNetWorth([{ type: "LOAN", balanceCents: 5000, currency: "USD" }]).netWorthCents).toBe(-5000);
  });
});

describe("spending", () => {
  const txns = [
    { date: "2026-10-01", amountCents: -110400, categorySlug: "housing" },
    { date: "2026-10-02", amountCents: -58400, categorySlug: "food" },
    { date: "2026-10-03", amountCents: -2000, categorySlug: "health" },
    { date: "2026-10-03", amountCents: -50000, categorySlug: "transfer", categoryKind: "TRANSFER" as const },
    { date: "2026-10-05", amountCents: 500000, categorySlug: "income" },
  ];
  it("excludes transfers and inflows; folds unknown groups into other", () => {
    const r = spendingBreakdown(txns);
    expect(r.totalCents).toBe(170800);
    expect(r.slices.map((s) => s.group)).toEqual(["housing", "food", "other"]);
    expect(r.slices[0].percent).toBeCloseTo(64.6, 1);
  });
  it("computes savings rate and monthly cash flow", () => {
    expect(savingsRate(500000, 170800)).toBeCloseTo(65.8, 1);
    expect(savingsRate(0, 100)).toBeNull();
    const cf = monthlyCashflow(txns);
    expect(cf).toHaveLength(1);
    expect(cf[0].netCents).toBe(500000 - 170800);
  });
});

describe("budgets", () => {
  it("flags warning at the threshold and over when exceeded", () => {
    expect(budgetLineStatus({ categoryId: "a", limitCents: 10000, spentCents: 7999, alertThreshold: 80 }).health).toBe("ok");
    expect(budgetLineStatus({ categoryId: "a", limitCents: 10000, spentCents: 8000, alertThreshold: 80 }).health).toBe("warning");
    const over = budgetLineStatus({ categoryId: "a", limitCents: 10000, spentCents: 12000, alertThreshold: 80 });
    expect(over.health).toBe("over");
    expect(over.remainingCents).toBe(-2000);
    expect(over.percentUsed).toBe(120);
  });
  it("summarizes lines", () => {
    const s = summarizeBudget([
      { categoryId: "a", limitCents: 10000, spentCents: 5000, alertThreshold: 80 },
      { categoryId: "b", limitCents: 20000, spentCents: 25000, alertThreshold: 80 },
    ]);
    expect(s.limitCents).toBe(30000);
    expect(s.spentCents).toBe(30000);
    expect(s.remainingCents).toBe(0);
    expect(s.overCount).toBe(1);
  });
  it("projects month end from pace", () => {
    expect(projectMonthEnd(10000, 10, 30)).toBe(30000);
  });
});

describe("categorization", () => {
  it("applies transparent keyword rules", () => {
    expect(categorize("STARBUCKS #1234", "", -550).slug).toBe("food");
    expect(categorize("NETFLIX.COM", "", -1599).slug).toBe("subscriptions");
    expect(categorize("ACME PAYROLL", "Direct deposit", 400000).slug).toBe("income");
    expect(categorize("Shell Oil 5543", "", -4500).slug).toBe("transport");
    expect(categorize("Unknown Merchant", "", -100).slug).toBe("other");
    expect(categorize("Unknown Payer", "", 100).slug).toBe("income");
  });
  it("does not treat an outflow matching an income keyword as income", () => {
    expect(categorize("Refund processing fee", "", -500).slug).not.toBe("income");
  });
  it("normalizes merchant keys", () => {
    expect(merchantKey("SPOTIFY USA*P1234")).toBe("spotify usa");
    expect(merchantKey("Netflix.com #99")).toBe("netflix com");
  });
});

describe("recurring detection", () => {
  const monthly = ["2026-05-03", "2026-06-03", "2026-07-03", "2026-08-03", "2026-09-03"].map((d) => ({ date: d, merchant: "NETFLIX.COM", amountCents: -1599 }));
  it("detects a monthly subscription as a suspected candidate", () => {
    const r = detectRecurring(monthly);
    expect(r).toHaveLength(1);
    expect(r[0].frequency).toBe("MONTHLY");
    expect(r[0].typicalAmountCents).toBe(1599);
    expect(r[0].estimatedAnnualCents).toBe(1599 * 12);
    expect(r[0].nextExpected).toBe("2026-10-04");
  });
  it("ignores irregular merchants and too few occurrences", () => {
    const irregular = ["2026-01-01", "2026-01-09", "2026-03-20", "2026-07-02"].map((d) => ({ date: d, merchant: "Corner Store", amountCents: -2000 }));
    expect(detectRecurring(irregular)).toHaveLength(0);
    expect(detectRecurring(monthly.slice(0, 2))).toHaveLength(0);
  });
  it("ignores unstable amounts", () => {
    const amounts = [-1000, -9000, -2500, -15000];
    const t = amounts.map((a, i) => ({ date: `2026-0${i + 1}-10`, merchant: "Utility Co", amountCents: a }));
    expect(detectRecurring(t)).toHaveLength(0);
  });
});

describe("goals", () => {
  it("computes required monthly and on-track status", () => {
    const p = projectGoal({ targetCents: 1200000, savedCents: 600000, targetDate: "2027-04-14", plannedMonthlyCents: 100000, today: "2026-10-14" });
    expect(p.percent).toBe(50);
    expect(p.monthsLeft).toBe(6);
    expect(p.requiredMonthlyCents).toBe(100000);
    expect(p.onTrack).toBe(true);
    expect(p.projectedCompletion).toBe("2027-04");
  });
  it("is off track when planned contributions are too low", () => {
    const p = projectGoal({ targetCents: 1200000, savedCents: 0, targetDate: "2027-10-14", plannedMonthlyCents: 50000, today: "2026-10-14" });
    expect(p.onTrack).toBe(false);
  });
  it("handles completed goals and no plan", () => {
    expect(projectGoal({ targetCents: 100, savedCents: 150, targetDate: null, plannedMonthlyCents: null, today: "2026-10-14" }).percent).toBe(100);
    expect(projectGoal({ targetCents: 100, savedCents: 0, targetDate: null, plannedMonthlyCents: null, today: "2026-10-14" }).onTrack).toBeNull();
  });
});

describe("portfolio", () => {
  it("separates contributions from market gains", () => {
    const r = portfolioPerformance([
      { date: "2026-01-01", marketValueCents: 1000000, netContributionsCents: 900000 },
      { date: "2026-10-01", marketValueCents: 1600000, netContributionsCents: 1400000 },
    ])!;
    expect(r.valueChangeCents).toBe(600000);
    expect(r.netContributionsCents).toBe(500000);
    expect(r.marketGainCents).toBe(100000);
    expect(r.returnPercent).toBeCloseTo(8, 0);
  });
  it("growth entirely from deposits is a zero return", () => {
    const r = portfolioPerformance([
      { date: "2026-01-01", marketValueCents: 100000, netContributionsCents: 100000 },
      { date: "2026-02-01", marketValueCents: 600000, netContributionsCents: 600000 },
    ])!;
    expect(r.marketGainCents).toBe(0);
    expect(r.returnPercent).toBe(0);
  });
  it("measures concentration", () => {
    const s = summarizePortfolio([
      { symbol: "AAA", type: "STOCK", sector: "Tech", marketValueCents: 900, costBasisCents: 500 },
      { symbol: "BBB", type: "ETF", sector: null, marketValueCents: 100, costBasisCents: 100 },
    ]);
    expect(s.largestPositionPercent).toBe(90);
    expect(s.concentrationLevel).toBe("concentrated");
    expect(s.unrealizedGainCents).toBe(400);
  });
});

describe("spending spikes", () => {
  const base = { day: 14, daysInMonth: 31 };
  it("never extrapolates a single rent payment", () => {
    expect(spendingSpike({ ...base, group: "housing", spentCents: 185000, txnCount: 1, monthlyAverageCents: 185000 })).toBeNull();
    expect(spendingSpike({ ...base, group: "utilities", spentCents: 19600, txnCount: 3, monthlyAverageCents: 24745 })).toBeNull();
  });
  it("flags fixed bills only when actual spending already exceeds the usual amount", () => {
    expect(spendingSpike({ ...base, group: "housing", spentCents: 300000, txnCount: 2, monthlyAverageCents: 185000 })).toEqual({ method: "actual", projectedCents: 300000 });
  });
  it("requires enough purchases before projecting a pace", () => {
    expect(spendingSpike({ ...base, group: "shopping", spentCents: 20000, txnCount: 2, monthlyAverageCents: 25000 })).toBeNull();
    expect(spendingSpike({ ...base, group: "food", spentCents: 60000, txnCount: 12, monthlyAverageCents: 70000 })).toEqual({ method: "pace", projectedCents: Math.round((60000 / 14) * 31) });
  });
  it("ignores small categories", () => {
    expect(spendingSpike({ ...base, group: "entertainment", spentCents: 4000, txnCount: 5, monthlyAverageCents: 3000 })).toBeNull();
  });
});
