import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as setup } from "@/app/api/setup/route";
import { POST as createTxn } from "@/app/api/transactions/route";
import { POST as createAccount } from "@/app/api/accounts/route";
import { GET as getProfile } from "@/app/api/plan/profile/route";
import { PATCH as patchAssumptions } from "@/app/api/plan/assumptions/route";
import { POST as runScenario } from "@/app/api/plan/scenario/route";
import { POST as decide } from "@/app/api/plan/decision/route";
import { POST as stress } from "@/app/api/plan/stress/route";
import { GET as listPlans, POST as savePlan } from "@/app/api/plan/snapshots/route";
import { DELETE as deletePlan, GET as getPlan } from "@/app/api/plan/snapshots/[id]/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { db } from "@/server/db";
import { addMonths, todayIn } from "@/server/dates";
import { call, newUser } from "./helpers";

const thisMonth = todayIn("UTC").slice(0, 7);

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
      goal: { name: "Emergency fund", kind: "EMERGENCY_FUND", target: "6000", targetDate: null, plannedMonthly: "500" },
    },
  });
  return u;
}

describe("financial profile", () => {
  it("explains every figure and falls back to the budget without transaction history", async () => {
    const u = await plannedUser();
    const r = await call(getProfile, "/api/plan/profile", { cookie: u.cookie });
    const p = r.json.profile;
    expect(p.figures.income).toMatchObject({ cents: 400000, source: "entered" });
    expect(p.figures.liquid).toMatchObject({ cents: 600000, source: "entered" });
    expect(p.figures.essential).toMatchObject({ cents: 200000, source: "budget" }); // housing + food
    expect(p.figures.discretionary).toMatchObject({ cents: 40000, source: "budget" });
    expect(p.figures.debt.cents).toBe(120000);
    expect(p.figures.reserveMonths).toBe(3);
    expect(p.canProject).toBe(true);
    expect(p.issues.some((i: { message: string }) => /interest rate and monthly payment for Visa/.test(i.message))).toBe(true);
  });

  it("uses transaction history over the budget and reports missing data honestly", async () => {
    const u = await newUser(register);
    const empty = (await call(getProfile, "/api/plan/profile", { cookie: u.cookie })).json.profile;
    expect(empty.canProject).toBe(false);
    expect(empty.figures.income.source).toBe("missing");
    expect(empty.figures.income.cents).toBeNull();

    const last = addMonths(thisMonth, -1);
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: `${last}-03`, amount: "3000", merchant: "ACME Payroll" } });
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: `${last}-05`, amount: "-1400", merchant: "Rent - Oak Apartments" } });
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: `${last}-09`, amount: "-120", merchant: "Steam games" } });
    const p = (await call(getProfile, "/api/plan/profile", { cookie: u.cookie })).json.profile;
    expect(p.monthsOfHistory).toBe(1);
    expect(p.figures.income).toMatchObject({ cents: 300000, source: "imported" });
    expect(p.figures.essential.cents).toBe(140000);
    expect(p.figures.discretionary.cents).toBe(12000);
  });

  it("prefers the budget when recorded transactions look incomplete", async () => {
    const u = await plannedUser(); // budget totals $2,400/mo
    const last = addMonths(thisMonth, -1);
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: `${last}-04`, amount: "-15.49", merchant: "Netflix" } });
    const p = (await call(getProfile, "/api/plan/profile", { cookie: u.cookie })).json.profile;
    expect(p.figures.essential).toMatchObject({ cents: 200000, source: "budget" });
    expect(p.figures.essential.basis).toMatch(/look incomplete/);
    expect(p.issues.some((i: { message: string }) => /look incomplete/.test(i.message))).toBe(true);
  });

  it("lets the user change assumptions and exclude accounts, but only their own", async () => {
    const u = await plannedUser();
    const other = await newUser(register);
    const p = (await call(getProfile, "/api/plan/profile", { cookie: u.cookie })).json.profile;
    const visa = p.accounts.find((a: { name: string }) => a.name === "Visa");
    const ok = await call(patchAssumptions, "/x", { cookie: u.cookie, method: "PATCH", body: { emergencyMonths: 6, essentialCategories: ["housing"], debts: { [visa.id]: { aprPercent: 24, monthlyPaymentCents: 10000 } } } });
    expect(ok.status).toBe(200);
    const after = (await call(getProfile, "/api/plan/profile", { cookie: u.cookie })).json.profile;
    expect(after.assumptions.emergencyMonths).toBe(6);
    expect(after.figures.essential.cents).toBe(150000);
    expect(after.debts[0]).toMatchObject({ aprPercent: 24, monthlyPaymentCents: 10000 });
    expect((await call(patchAssumptions, "/x", { cookie: other.cookie, method: "PATCH", body: { excludedAccountIds: [visa.id] } })).status).toBe(400);
  });
});

describe("what-if, decisions, stress tests and saved plans", () => {
  it("runs a scenario against the server-side baseline with ranges and drivers", async () => {
    const u = await plannedUser();
    const r = await call(runScenario, "/x", {
      cookie: u.cookie,
      body: {
        horizonMonths: 12,
        changes: [
          { kind: "income", label: "Income −15%", percent: -15, startMonth: 0, months: null },
          { kind: "one_time", label: "Vacation", amountCents: 250000, month: 5 },
        ],
      },
    });
    expect(r.status).toBe(200);
    expect(r.json.scenario.series).toHaveLength(12);
    expect(r.json.comparison.endLiquidDeltaCents).toBe(-(12 * 60000 + 250000));
    expect(r.json.drivers.map((d: { label: string }) => d.label)).toEqual(["Income −15%", "Vacation"]);
    expect(r.json.scenario.adverse[11]).toBeLessThan(r.json.scenario.series[11].liquidCents);
    // A client can't smuggle in its own baseline
    const bad = await call(runScenario, "/x", { cookie: u.cookie, body: { changes: [{ kind: "one_time", label: "x", amountCents: 0, month: 0 }] } });
    expect(bad.status).toBe(422);
  });

  it("reviews a purchase with the category budget and explains the verdict", async () => {
    const u = await plannedUser();
    const r = await call(decide, "/x", { cookie: u.cookie, body: { label: "Laptop", priceCents: 150000, categorySlug: "entertainment", alternative: { label: "Last year's model", priceCents: 110000 } } });
    const d = r.json.decision;
    expect(d.verdict).toBe("consider");
    expect(d.category).toMatchObject({ name: "Entertainment", remainingCents: 40000 });
    expect(d.reasons.map((x: { code: string }) => x.code)).toEqual(expect.arrayContaining(["over_category_budget", "cheaper_option"]));
    expect(d.options.map((o: { key: string }) => o.key)).toEqual(["buy_now", "buy_later", "alternative", "skip"]);
    const big = (await call(decide, "/x", { cookie: u.cookie, body: { label: "Car repair", priceCents: 500000 } })).json.decision;
    expect(big.verdict).toBe("risk");
  });

  it("stress-tests income loss with runway and preparation steps", async () => {
    const u = await plannedUser();
    const r = await call(stress, "/x", { cookie: u.cookie, body: { incomeLossMonths: 3, emergencyCostCents: 100000, discretionaryCutPct: 50 } });
    expect(r.status).toBe(200);
    expect(r.json.runway.noIncomeMonths).toBe(2.5); // ($6,000 − $1,000) / $2,000
    expect(r.json.stressed.summary.firstNegativeMonth).toBe(2);
    expect(r.json.steps.length).toBeGreaterThan(0);
  });

  it("saves an immutable plan, compares it with actuals, and keeps plans private", async () => {
    const u = await plannedUser();
    const other = await newUser(register);
    const s = await call(savePlan, "/x", { cookie: u.cookie, body: { name: "Laptop plan", kind: "purchase", changes: [{ kind: "one_time", label: "Laptop", amountCents: 150000, month: 1 }], horizonMonths: 12, decision: { label: "Laptop", priceCents: 150000, verdict: "consider", choice: "buy_later" } } });
    const id = s.json.plan.id;
    // Data changes later must not rewrite the saved projection
    await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Savings", type: "SAVINGS", balance: "9000" } });
    const r = await call(getPlan, "/x", { cookie: u.cookie, params: { id } });
    expect(r.json.plan.baseline.liquidCents).toBe(600000);
    expect(r.json.plan.projected[0].liquidCents).toBe(600000 + 400000 - 240000);
    expect(r.json.plan.rows[0].actual.liquidCents).toBe(600000); // only the accounts the plan was built on
    expect(r.json.plan.findings[0].text).toMatch(/saved this month/);
    expect((await call(listPlans, "/x", { cookie: u.cookie })).json.plans).toHaveLength(1);
    expect((await call(getPlan, "/x", { cookie: other.cookie, params: { id } })).status).toBe(404);
    expect((await call(deletePlan, "/x", { cookie: other.cookie, method: "DELETE", params: { id } })).status).toBe(404);
    expect(await db.planSnapshot.count({ where: { id } })).toBe(1);
  });

  it("compares a plan from earlier months with actual balances and spending", async () => {
    const u = await plannedUser();
    const s = await call(savePlan, "/x", { cookie: u.cookie, body: { name: "Baseline", kind: "scenario", changes: [], horizonMonths: 12 } });
    const id = s.json.plan.id;
    const start = addMonths(thisMonth, -2);
    await db.planSnapshot.update({ where: { id }, data: { startMonth: start } });
    const userId = (await db.user.findUniqueOrThrow({ where: { email: u.email } })).id;
    const checking = await db.connectedAccount.findFirstOrThrow({ where: { userId, name: "Checking" } });
    await db.accountBalance.create({ data: { userId, accountId: checking.id, asOf: new Date(`${start}-20T00:00:00Z`), balance: "6500" } });
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: `${start}-02`, amount: "4000", merchant: "ACME Payroll" } });
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: `${start}-05`, amount: "-3100", merchant: "Rent - Oak Apartments" } });
    const r = (await call(getPlan, "/x", { cookie: u.cookie, params: { id } })).json.plan;
    expect(r.elapsedMonths).toBe(2);
    expect(r.rows[0]).toMatchObject({ ym: start, complete: true, actual: { liquidCents: 650000, incomeCents: 400000, spendingCents: 310000 } });
    const texts = r.findings.map((f: { text: string }) => f.text).join(" | ");
    expect(texts).toMatch(/Income matched the plan/);
    expect(texts).toMatch(/Spending averaged \$3,100\.00 a month, \$700\.00 more than planned/);
  });

});

describe("advisor answers what-if questions from the plan engine", () => {
  it("reviews a purchase, runs a scenario and a stress test without an AI key", async () => {
    const u = await plannedUser();
    const ask = async (message: string) => (await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message } })).json.message;

    const buy = await ask("What if I buy a $5,000 used car?");
    expect(buy.content).toMatch(/^Could put a goal at risk — Used car:/);
    expect(buy.content).toMatch(/It's your call/);
    expect(buy.evidence.tools[0]).toMatchObject({ name: "review_purchase", link: { href: expect.stringContaining("/app/plan?tab=decide") } });
    expect(buy.actions).toEqual([]);

    const drop = await ask("What if my income drops by 15%?");
    expect(drop.content).toMatch(/If income −15%, here's the projection/);
    expect(drop.content).toMatch(/not predictions/);

    const stressReply = await ask("What if I lose my job for 3 months?");
    expect(stressReply.content).toMatch(/cash covers about 3 months of essential spending/);
    expect(stressReply.content).toMatch(/How to prepare/);

    // A plain data update still becomes a proposal, not a what-if
    const update = await ask("My rent went up to $1,600");
    expect(update.actions[0].kind).toBe("set_budget_limit");
  });
});
