import { describe, expect, it } from "vitest";
import { buildOpportunityMap, MAP_AREA_IDS, type MapInput } from "../src/finance/opportunity-map";

const empty: MapInput = {
  currency: "USD",
  hasAccounts: false,
  incomeCents: null,
  essentialCents: null,
  discretionaryCents: null,
  surplusCents: null,
  liquidCents: null,
  emergencyTargetMonths: 3,
  debts: [],
  recurring: { count: 0, monthlyCents: 0, duplicateMerchants: [] },
  goals: [],
  products: { active: 0, withTarget: 0, atOrBelowTarget: 0 },
  trips: { upcoming: 0, overBudget: [], withoutBudget: 0 },
  investments: { cents: null, holdings: 0 },
  records: { transactions: 0, uncategorized: 0, staleAccounts: 0, monthsOfHistory: 0, issues: 0 },
  accounts: 0,
  opportunities: {},
};

const typical: MapInput = {
  ...empty,
  hasAccounts: true,
  incomeCents: 500_000,
  essentialCents: 250_000,
  discretionaryCents: 150_000,
  surplusCents: 80_000,
  liquidCents: 300_000,
  debts: [
    { name: "Visa", balanceCents: 400_000, aprPercent: 24 },
    { name: "Car loan", balanceCents: 1_000_000, aprPercent: null },
  ],
  recurring: { count: 6, monthlyCents: 9_000, duplicateMerchants: ["Spotify"] },
  goals: [{ name: "Car", targetCents: 1_000_000, savedCents: 100_000, monthlyCents: 20_000, targetMonth: 12 }],
  products: { active: 2, withTarget: 1, atOrBelowTarget: 1 },
  trips: { upcoming: 1, overBudget: [{ name: "Lisbon", overCents: 30_000 }], withoutBudget: 0 },
  investments: { cents: 2_000_000, holdings: 3 },
  records: { transactions: 120, uncategorized: 5, staleAccounts: 0, monthsOfHistory: 3, issues: 1 },
  accounts: 4,
  opportunities: { cash_flow: { count: 2, potentialAnnualCents: 21_588 }, travel: { count: 1, potentialAnnualCents: 0 } },
};

const area = (r: ReturnType<typeof buildOpportunityMap>, id: string) => r.areas.find((a) => a.id === id)!;

describe("personal opportunity map", () => {
  it("covers every area, each with a next step, and reports unknowns honestly for a new user", () => {
    const r = buildOpportunityMap(empty);
    expect(r.areas.map((a) => a.id).sort()).toEqual([...MAP_AREA_IDS].sort());
    for (const a of r.areas) {
      expect(a.nextStep.href).toMatch(/^\/app/);
      expect(a.impact.cents === null || a.impact.cents > 0).toBe(true);
    }
    expect(area(r, "cash_flow")).toMatchObject({ status: "unknown", confidence: "low", nextStep: { href: "/app/setup" } });
    expect(area(r, "cash_flow").dependencies).toEqual(["Your income", "Spending history or a monthly budget"]);
    expect(area(r, "emergency_reserve").status).toBe("unknown");
  });

  it("calculates impact only where it can, and labels what kind it is", () => {
    const r = buildOpportunityMap(typical);
    expect(area(r, "cash_flow").impact).toMatchObject({ cents: 21_588, kind: "possible_savings" });
    // Reserve: 3 × 2,500 − 3,000 = 4,500 still to save; 800/mo surplus → 6 months
    expect(area(r, "emergency_reserve").impact).toMatchObject({ cents: 450_000, kind: "gap" });
    expect(area(r, "emergency_reserve").timeToBenefit).toMatch(/About 6 months/);
    // Interest: only debts with a known rate (4,000 × 24% = 960/yr); the missing rate is a dependency
    const debt = area(r, "borrowing_costs");
    expect(debt.impact).toMatchObject({ cents: 96_000, kind: "at_stake" });
    expect(debt.dependencies).toEqual(["Interest rate for Car loan"]);
    expect(debt).toMatchObject({ status: "focus", confidence: "low" });
    // Goal: 10,000 − 1,000 − 200×12 = 6,600 short
    expect(area(r, "major_purchase").impact).toMatchObject({ cents: 660_000, kind: "gap" });
    expect(area(r, "travel").impact).toMatchObject({ cents: 30_000, kind: "gap" });
    // No invented figures where there are no sources
    for (const id of ["income", "better_value", "investing"]) expect(area(r, id).impact.cents).toBeNull();
    expect(area(r, "income").dependencies[0]).toMatch(/not available/);
    expect(area(r, "complexity").position).toMatch(/Spotify/);
  });

  it("puts the user's chosen focus areas first in their order, and hides what they hid", () => {
    const r = buildOpportunityMap(typical, { focus: ["investing", "records"], hidden: ["travel", "records"] });
    expect(r.areas.slice(0, 2).map((a) => a.id)).toEqual(["investing", "records"]);
    // A focus area can't also be hidden
    expect(r.hidden.map((a) => a.id)).toEqual(["travel"]);
    expect(r.areas.find((a) => a.id === "travel")).toBeUndefined();
    // Without preferences, areas needing attention come before strong ones
    const d = buildOpportunityMap(typical).areas.map((a) => a.status);
    const rank = { focus: 0, room: 1, unknown: 2, strong: 3 } as const;
    expect(d.map((s) => rank[s])).toEqual([...d.map((s) => rank[s])].sort((a, b) => a - b));
  });

  it("marks a deficit as a focus and a healthy surplus as strong", () => {
    expect(area(buildOpportunityMap({ ...typical, surplusCents: -20_000, opportunities: {} }), "cash_flow")).toMatchObject({ status: "focus" });
    expect(area(buildOpportunityMap({ ...typical, surplusCents: 100_000, opportunities: {} }), "cash_flow").status).toBe("strong");
    expect(area(buildOpportunityMap({ ...typical, liquidCents: 900_000 }), "emergency_reserve")).toMatchObject({ status: "strong", timeToBenefit: "Already there" });
  });
});
