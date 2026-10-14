import { describe, expect, it } from "vitest";
import { detectPriceIncrease, rankOpportunity, totalPotentialSavings } from "../src";

describe("opportunity ranking", () => {
  it("adds impact and urgency, then applies confidence and feedback", () => {
    const r = rankOpportunity({ priority: 60, impactCents: 120_000, impactType: "POTENTIAL", daysUntil: 5, confidence: "medium", recentDismissalsOfKind: 0 });
    expect(r).toMatchObject({ base: 60, impact: 30, urgency: 18, confidenceFactor: 0.85, feedbackFactor: 1 });
    expect(r.score).toBe(Math.round((60 + 30 + 18) * 0.85 * 10) / 10);
  });

  it("ranks urgent, confident items above vague ones and learns only from dismissals per kind", () => {
    const urgent = rankOpportunity({ priority: 50, impactCents: 1_500, impactType: "CONFIRMED", daysUntil: 2, confidence: "high", recentDismissalsOfKind: 0 });
    const vague = rankOpportunity({ priority: 50, impactCents: 1_500, impactType: "CONFIRMED", daysUntil: null, confidence: "low", recentDismissalsOfKind: 0 });
    expect(urgent.score).toBeGreaterThan(vague.score);
    const dismissed = rankOpportunity({ priority: 50, impactCents: null, impactType: "NONE", daysUntil: null, confidence: "high", recentDismissalsOfKind: 2 });
    expect(dismissed.feedbackFactor).toBe(0.56);
    expect(rankOpportunity({ priority: 50, impactCents: 99_999, impactType: "NONE", daysUntil: null, confidence: "high", recentDismissalsOfKind: 0 }).impact).toBe(0);
  });
});

describe("recurring price increases", () => {
  it("compares the latest charge with the median of earlier ones", () => {
    expect(detectPriceIncrease([
      { date: "2026-07-03", amountCents: -1549 },
      { date: "2026-08-03", amountCents: -1549 },
      { date: "2026-09-03", amountCents: -1799 },
    ])).toEqual({ previousCents: 1549, latestCents: 1799, increaseCents: 250, percent: 16.1, latestDate: "2026-09-03" });
  });
  it("ignores small or insufficient changes", () => {
    expect(detectPriceIncrease([{ date: "2026-08-01", amountCents: 1000 }, { date: "2026-09-01", amountCents: 1500 }])).toBeNull();
    expect(detectPriceIncrease([{ date: "2026-07-01", amountCents: 10000 }, { date: "2026-08-01", amountCents: 10000 }, { date: "2026-09-01", amountCents: 10300 }])).toBeNull();
  });
});

describe("potential savings", () => {
  it("never counts the same underlying saving twice", () => {
    expect(totalPotentialSavings([
      { savingsParts: [{ key: "rec:a", cents: 12_000 }, { key: "rec:b", cents: 6_000 }] },
      { savingsParts: [{ key: "rec:a", cents: 12_000 }] },
      { savingsParts: [{ key: "idle", cents: 4_000 }] },
      {},
    ])).toBe(22_000);
  });
});
