import { describe, expect, it } from "vitest";
import { ledgerTotals, sameMerchant, verifyRecurringOutcome } from "../src";

const base = { frequency: "MONTHLY" as const, baselineCents: 1799, actionDate: "2026-10-10", nextExpected: "2026-10-24", today: "2026-10-30" };

describe("verifying a cancellation", () => {
  it("stays pending until the data covers the next expected charge", () => {
    expect(verifyRecurringOutcome({ ...base, kind: "cancel", chargesAfter: [], dataThrough: "2026-10-28", today: "2026-10-28" })).toMatchObject({ status: "pending", realizedCents: 0, checkAfter: "2026-10-30" });
    // Even after the date, missing data is not proof
    expect(verifyRecurringOutcome({ ...base, kind: "cancel", chargesAfter: [], dataThrough: "2026-10-20", today: "2026-11-15" }).status).toBe("pending");
  });

  it("confirms when expected charges didn't happen and counts only those as realized", () => {
    const r = verifyRecurringOutcome({ ...base, kind: "cancel", chargesAfter: [], dataThrough: "2026-12-26", today: "2026-12-27" });
    expect(r).toMatchObject({ status: "confirmed", realizedCents: 3 * 1799, confirmedAnnualCents: 12 * 1799 });
  });

  it("is not confirmed when the merchant charged again, and ignores charges before the action", () => {
    const r = verifyRecurringOutcome({ ...base, kind: "cancel", chargesAfter: [{ date: "2026-10-03", amountCents: 1799 }, { date: "2026-10-24", amountCents: 1799 }], dataThrough: "2026-10-30" });
    expect(r).toMatchObject({ status: "not_confirmed", realizedCents: 0 });
    expect(r.reason).toMatch(/2026-10-24/);
  });
});

describe("verifying a negotiation", () => {
  it("measures the actual reduction from later charges", () => {
    const r = verifyRecurringOutcome({ ...base, kind: "negotiate", chargesAfter: [{ date: "2026-10-24", amountCents: 1299 }, { date: "2026-11-24", amountCents: 1299 }], dataThrough: "2026-11-30" });
    expect(r).toMatchObject({ status: "confirmed", realizedCents: 1000, confirmedAnnualCents: 500 * 12 });
  });
  it("waits for a charge, and rejects a non-reduction", () => {
    expect(verifyRecurringOutcome({ ...base, kind: "negotiate", chargesAfter: [], dataThrough: "2026-10-25" }).status).toBe("pending");
    expect(verifyRecurringOutcome({ ...base, kind: "negotiate", chargesAfter: [{ date: "2026-10-24", amountCents: 1799 }], dataThrough: "2026-10-30" }).status).toBe("not_confirmed");
  });
});

describe("outcome ledger", () => {
  it("keeps stages separate and counts each opportunity once, at its furthest stage", () => {
    const t = ledgerTotals([
      { key: "netflix", stage: "identified", estimatedAnnualCents: 21588, confirmedAnnualCents: 0, realizedCents: 0 },
      { key: "netflix", stage: "confirmed", estimatedAnnualCents: 21588, confirmedAnnualCents: 21588, realizedCents: 3597 },
      { key: "gym", stage: "initiated", estimatedAnnualCents: 48000, confirmedAnnualCents: 0, realizedCents: 0 },
      { key: "phone", stage: "identified", estimatedAnnualCents: 12000, confirmedAnnualCents: 0, realizedCents: 0 },
      { key: "music", stage: "not_confirmed", estimatedAnnualCents: 12000, confirmedAnnualCents: 0, realizedCents: 0 },
    ]);
    expect(t).toEqual({
      identified: { count: 1, estimatedAnnualCents: 12000 },
      planned: { count: 0, estimatedAnnualCents: 0 },
      initiated: { count: 1, estimatedAnnualCents: 48000 },
      confirmed: { count: 1, confirmedAnnualCents: 21588 },
      notConfirmed: { count: 1 },
      realizedCents: 3597,
    });
  });
});

describe("merchant matching", () => {
  it("matches common bank descriptor variations, conservatively", () => {
    expect(sameMerchant("Netflix", "NETFLIX.COM")).toBe(true);
    expect(sameMerchant("Spotify", "Spotify USA Subscription")).toBe(true);
    expect(sameMerchant("Comcast Xfinity", "COMCAST CABLE")).toBe(true);
    expect(sameMerchant("Netflix", "Hulu")).toBe(false);
    expect(sameMerchant("Apple", "Apple Store")).toBe(false); // short first word isn't enough
  });
});
