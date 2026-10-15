import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as setup } from "@/app/api/setup/route";
import { GET as getProfile } from "@/app/api/plan/profile/route";
import { PATCH as patchAssumptions } from "@/app/api/plan/assumptions/route";
import { GET as getMap, PATCH as patchMap } from "@/app/api/map/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { call, newUser } from "./helpers";

type A = { id: string; status: string; impact: { cents: number | null; kind: string }; dependencies: string[]; timeToBenefit: string; position: string };

async function plannedUser() {
  const u = await newUser(register);
  await call(setup, "/api/setup", {
    cookie: u.cookie,
    body: {
      path: "manual",
      accounts: [
        { name: "Checking", type: "CHECKING", balance: "6000" },
        { name: "Visa", type: "CREDIT_CARD", balance: "1200" },
      ],
      monthlyIncome: "4000",
      budget: [
        { category: "housing", limit: "1500" },
        { category: "food", limit: "500" },
        { category: "entertainment", limit: "400" },
      ],
      goal: { name: "New car", kind: "CAR", target: "20000", targetDate: null, plannedMonthly: "300" },
    },
  });
  return u;
}
const find = (areas: A[], id: string) => areas.find((a) => a.id === id)!;

describe("personal opportunity map", () => {
  it("builds every area from the user's own data and shows what's missing", async () => {
    const u = await plannedUser();
    const m = (await call(getMap, "/api/map", { cookie: u.cookie })).json;
    expect(m.areas).toHaveLength(10);
    // Income 4,000 − essentials 2,000 − entertainment 400 = 1,600 left; no open savings yet
    expect(find(m.areas, "cash_flow").position).toMatch(/\$1,600\.00 a month/);
    // Cash 6,000 covers 3 months of 2,000 essentials, the default target
    expect(find(m.areas, "emergency_reserve")).toMatchObject({ status: "strong", timeToBenefit: "Already there" });
    // Visa without an interest rate: unknown, and the rate is listed as missing
    expect(find(m.areas, "borrowing_costs")).toMatchObject({ status: "unknown", impact: { cents: null }, dependencies: ["Interest rate for Visa"] });
    expect(find(m.areas, "income").impact.cents).toBeNull();
    // An undated goal isn't called "on pace"; the missing date is listed instead
    expect(find(m.areas, "major_purchase").position).toMatch(/1 without a target date/);
    expect(find(m.areas, "major_purchase").dependencies).toContain('A target date for "New car"');
  });

  it("counts an emergency-fund goal toward the reserve, not a major purchase, and asks for transactions", async () => {
    const u = await newUser(register);
    await call(setup, "/api/setup", {
      cookie: u.cookie,
      body: { path: "manual", accounts: [{ name: "Checking", type: "CHECKING", balance: "1000" }], monthlyIncome: "3000", budget: [{ category: "housing", limit: "1200" }], goal: { name: "Safety net", kind: "EMERGENCY_FUND", target: "5000", targetDate: null, plannedMonthly: "200" } },
    });
    const m = (await call(getMap, "/api/map", { cookie: u.cookie })).json;
    expect(find(m.areas, "major_purchase").position).toBe("No savings goals yet.");
    expect(find(m.areas, "records")).toMatchObject({ status: "room" });
    expect(find(m.areas, "records").position).toMatch(/No transactions recorded yet/);
  });

  it("recalculates when the user's assumptions change", async () => {
    const u = await plannedUser();
    const visa = (await call(getProfile, "/x", { cookie: u.cookie })).json.profile.debts[0];
    await call(patchAssumptions, "/x", { cookie: u.cookie, method: "PATCH", body: { emergencyMonths: 6, debts: { [visa.id]: { aprPercent: 24, monthlyPaymentCents: 10000 } } } });
    const m = (await call(getMap, "/api/map", { cookie: u.cookie })).json;
    // 6 × 2,000 − 6,000 = 6,000 to go; surplus 1,600 − 100 card payment = 1,500/mo → 4 months
    expect(find(m.areas, "emergency_reserve")).toMatchObject({ status: "room", impact: { cents: 600000, kind: "gap" } });
    expect(find(m.areas, "emergency_reserve").timeToBenefit).toMatch(/About 4 months/);
    // 1,200 × 24% = 288 a year at stake
    expect(find(m.areas, "borrowing_costs")).toMatchObject({ status: "focus", impact: { cents: 28800, kind: "at_stake" }, dependencies: [] });
  });

  it("orders by the user's priorities, hides what they hid, validates choices, and keeps them private", async () => {
    const u = await plannedUser();
    const other = await plannedUser();
    expect((await call(patchMap, "/x", { cookie: u.cookie, method: "PATCH", body: { focus: ["travel", "income"], hidden: ["complexity", "travel"] } })).json.prefs).toEqual({ focus: ["travel", "income"], hidden: ["complexity"] });
    const m = (await call(getMap, "/api/map", { cookie: u.cookie })).json;
    expect(m.areas.slice(0, 2).map((a: A) => a.id)).toEqual(["travel", "income"]);
    expect(m.hidden.map((a: A) => a.id)).toEqual(["complexity"]);
    expect(m.areas).toHaveLength(9);

    expect((await call(patchMap, "/x", { cookie: u.cookie, method: "PATCH", body: { focus: ["travel", "income", "records", "investing"] } })).status).toBe(422);
    expect((await call(patchMap, "/x", { cookie: u.cookie, method: "PATCH", body: { focus: ["travel", "travel"] } })).status).toBe(422);
    expect((await call(patchMap, "/x", { cookie: u.cookie, method: "PATCH", body: { focus: ["nonsense"] } })).status).toBe(422);

    const theirs = (await call(getMap, "/api/map", { cookie: other.cookie })).json;
    expect(theirs.prefs).toEqual({ focus: [], hidden: [] });
    expect(theirs.areas).toHaveLength(10);
  });

  it("answers 'where should I focus' from the map, leading with the user's priorities", async () => {
    const u = await plannedUser();
    await call(patchMap, "/x", { cookie: u.cookie, method: "PATCH", body: { focus: ["income"] } });
    const r = await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "Where should I focus?" } });
    const text: string = r.json.message.content;
    expect(text).toMatch(/areas you said matter most/);
    expect(text.indexOf("Increase income")).toBeGreaterThan(-1);
    expect(text).toMatch(/estimates, not promises/);
  });
});
