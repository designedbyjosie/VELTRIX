import { describe, expect, it } from "vitest";
import { parseWhatIf } from "@/server/ai/whatif";

const p = (q: string) => parseWhatIf(q, 10); // October

describe("what-if questions", () => {
  it("purchases", () => {
    expect(p("What if I buy a $1,500 computer today?")).toMatchObject({ type: "purchase", label: "Computer", priceCents: 150000 });
    expect(p("Can I afford a $350 purchase?")).toMatchObject({ type: "purchase", priceCents: 35000 });
    expect(p("Should I buy a new phone for $1,099 over 24 months at 9.9%?")).toMatchObject({ type: "purchase", label: "Phone", priceCents: 109900, financing: { months: 24, aprPercent: 9.9 } });
  });

  it("scenarios", () => {
    expect(p("What if my income drops by 15%?")).toEqual({ type: "scenario", changes: [{ kind: "income", label: "Income −15%", percent: -15, startMonth: 0, months: null }] });
    expect(p("What if my rent goes up $200 next year?")).toMatchObject({ type: "scenario", changes: [{ kind: "expense", bucket: "essential", amountCents: 20000, startMonth: 12 }] });
    expect(p("What if I take a $2,500 vacation this summer?")).toMatchObject({ type: "scenario", changes: [{ kind: "one_time", label: "Vacation", amountCents: 250000, month: 9 }] });
    expect(p("What if I pay an extra $200 toward my credit card?")).toMatchObject({ type: "scenario", changes: [{ kind: "extra_debt_payment", amountCents: 20000 }] });
    expect(p("What if I cut my spending by 20%?")).toMatchObject({ type: "scenario", changes: [{ kind: "expense", bucket: "discretionary", percent: -20 }] });
    expect(p("What if I save $300 more a month?")).toMatchObject({ type: "scenario", changes: [{ kind: "extra_saving", amountCents: 30000 }] });
  });

  it("stress tests", () => {
    expect(p("What if I lose my job for 3 months?")).toMatchObject({ type: "stress", incomeLossMonths: 3 });
    expect(p("Stress-test my finances if my income stops for six months")).toMatchObject({ type: "stress", incomeLossMonths: 6 });
    expect(p("How long could I last without a paycheck?")).toMatchObject({ type: "stress", incomeLossMonths: 3 });
  });

  it("ignores ordinary questions and data updates", () => {
    expect(p("Where did my money go this month?")).toBeNull();
    expect(p("Set my food budget to $400")).toBeNull();
    expect(p("My rent went up to $1,500")).toBeNull();
    expect(p("Compare VOO and QQQ")).toBeNull();
    expect(p("Show me my financial picture")).toEqual({ type: "profile" });
  });
});
