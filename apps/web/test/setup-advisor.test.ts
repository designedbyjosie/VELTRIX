import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createAccount } from "@/app/api/accounts/route";
import { GET as getBudgets } from "@/app/api/budgets/route";
import { GET as listGoals } from "@/app/api/goals/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { GET as getConversation } from "@/app/api/advisor/conversations/[id]/route";
import { POST as apply } from "@/app/api/advisor/actions/[id]/apply/route";
import { POST as dismiss } from "@/app/api/advisor/actions/[id]/dismiss/route";
import { GET as suggestions, POST as setup } from "@/app/api/setup/route";
import { GET as getLayout, PATCH as patchLayout } from "@/app/api/settings/dashboard/route";
import { db } from "@/server/db";
import { todayIn } from "@/server/dates";
import { call, newUser } from "./helpers";

const month = todayIn("UTC").slice(0, 7);
const userId = async (email: string) => (await db.user.findUniqueOrThrow({ where: { email } })).id;

describe("guided setup", () => {
  it("saves accounts, income, budget and goal in one step", async () => {
    const u = await newUser(register);
    const r = await call(setup, "/api/setup", {
      cookie: u.cookie,
      body: {
        path: "manual",
        accounts: [
          { name: "Checking", type: "CHECKING", balance: "2500.00" },
          { name: "Visa", type: "CREDIT_CARD", balance: "320.50" },
        ],
        monthlyIncome: "4200.00",
        budget: [
          { category: "housing", limit: "1400" },
          { category: "food", limit: "450" },
        ],
        goal: { name: "Emergency fund", kind: "EMERGENCY_FUND", target: "6000", targetDate: null, plannedMonthly: "300" },
      },
    });
    expect(r.status).toBe(200);
    const id = await userId(u.email);
    const profile = await db.userProfile.findUniqueOrThrow({ where: { userId: id } });
    expect(profile.onboardingCompletedAt).not.toBeNull();
    expect(profile.setupPath).toBe("manual");
    expect(profile.monthlyIncome?.toString()).toBe("4200");
    expect(await db.connectedAccount.count({ where: { userId: id } })).toBe(2);
    const budgets = (await call(getBudgets, "/api/budgets", { cookie: u.cookie, query: { month } })).json.budgets;
    expect(budgets[0].lines.map((l: { category: { slug: string } }) => l.category.slug).sort()).toEqual(["food", "housing"]);
    const goals = (await call(listGoals, "/api/goals", { cookie: u.cookie })).json.goals;
    expect(goals[0].name).toBe("Emergency fund");

    const s = await call(suggestions, "/api/setup", { cookie: u.cookie });
    expect(s.json.monthlyIncomeCents).toBe(420000);
    expect(s.json.accounts).toHaveLength(2);
  });

  it("rejects duplicate budget categories and bad amounts", async () => {
    const u = await newUser(register);
    const r = await call(setup, "/api/setup", { cookie: u.cookie, body: { path: "manual", budget: [{ category: "food", limit: "100" }, { category: "food", limit: "-5" }] } });
    expect(r.status).toBe(422);
  });
});

describe("advisor-proposed changes", () => {
  async function userWithData() {
    const u = await newUser(register);
    const acct = (await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Everyday Checking", type: "CHECKING", balance: "1000.00" } })).json.account;
    return { ...u, acct };
  }

  it("proposes changes from plain language and only applies them on request", async () => {
    const u = await userWithData();
    const r = await call(chat, "/api/advisor/chat", {
      cookie: u.cookie,
      body: { message: "Set my food budget to $400 and my checking balance is $2,500. Also hide investments from my dashboard" },
    });
    expect(r.status).toBe(200);
    const actions = r.json.message.actions;
    expect(actions.map((a: { kind: string }) => a.kind)).toEqual(["set_budget_limit", "update_account_balance", "set_dashboard_widget"]);
    expect(actions.every((a: { status: string }) => a.status === "PROPOSED")).toBe(true);

    // Nothing changed yet
    const id = await userId(u.email);
    expect((await db.connectedAccount.findUniqueOrThrow({ where: { id: u.acct.id } })).currentBalance.toString()).toBe("1000");

    for (const a of actions) {
      const res = await call(apply, "/x", { cookie: u.cookie, method: "POST", params: { id: a.id } });
      expect(res.status).toBe(200);
      expect(res.json.action.status).toBe("APPLIED");
    }
    expect((await db.connectedAccount.findUniqueOrThrow({ where: { id: u.acct.id } })).currentBalance.toString()).toBe("2500");
    const budgets = (await call(getBudgets, "/api/budgets", { cookie: u.cookie, query: { month } })).json.budgets;
    expect(budgets[0].lines[0]).toMatchObject({ limitCents: 40000, category: { slug: "food" } });
    expect((await call(getLayout, "/api/settings/dashboard", { cookie: u.cookie })).json.layout).not.toContain("performance");

    // Applying twice is refused; the conversation shows the final status.
    const again = await call(apply, "/x", { cookie: u.cookie, method: "POST", params: { id: actions[0].id } });
    expect(again.status).toBe(409);
    const convo = await call(getConversation, "/x", { cookie: u.cookie, params: { id: r.json.conversationId } });
    expect(convo.json.conversation.messages[1].actions.map((a: { status: string }) => a.status)).toEqual(["APPLIED", "APPLIED", "APPLIED"]);
    expect(await db.auditEvent.count({ where: { userId: id, type: "advisor.change_applied" } })).toBe(3);
  });

  it("dismissed or expired proposals can't be applied", async () => {
    const u = await userWithData();
    const r = await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "I make $5,000 a month" } });
    const [a] = r.json.message.actions;
    expect(a.summary).toMatch(/\$5,000\.00/);
    expect((await call(dismiss, "/x", { cookie: u.cookie, method: "POST", params: { id: a.id } })).json.action.status).toBe("DISMISSED");
    expect((await call(apply, "/x", { cookie: u.cookie, method: "POST", params: { id: a.id } })).status).toBe(409);

    const r2 = await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "I make $5,000 a month" } });
    await db.advisorAction.update({ where: { id: r2.json.message.actions[0].id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(apply, "/x", { cookie: u.cookie, method: "POST", params: { id: r2.json.message.actions[0].id } })).status).toBe(410);
    expect((await db.userProfile.findUniqueOrThrow({ where: { userId: await userId(u.email) } })).monthlyIncome).toBeNull();
  });

  it("another user can't apply or dismiss someone else's proposal", async () => {
    const owner = await userWithData();
    const other = await newUser(register);
    const r = await call(chat, "/api/advisor/chat", { cookie: owner.cookie, body: { message: "my checking balance is $9,999" } });
    const id = r.json.message.actions[0].id;
    expect((await call(apply, "/x", { cookie: other.cookie, method: "POST", params: { id } })).status).toBe(404);
    expect((await call(dismiss, "/x", { cookie: other.cookie, method: "POST", params: { id } })).status).toBe(404);
    expect((await db.connectedAccount.findUniqueOrThrow({ where: { id: owner.acct.id } })).currentBalance.toString()).toBe("1000");
  });

  it("re-checks at apply time: a proposal for a deleted account fails cleanly", async () => {
    const u = await userWithData();
    const r = await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "my checking balance is $50" } });
    await db.connectedAccount.delete({ where: { id: u.acct.id } });
    const res = await call(apply, "/x", { cookie: u.cookie, method: "POST", params: { id: r.json.message.actions[0].id } });
    expect(res.status).toBe(409);
    expect((await db.advisorAction.findUniqueOrThrow({ where: { id: r.json.message.actions[0].id } })).status).toBe("FAILED");
  });

  it("creates goals and records spending", async () => {
    const u = await userWithData();
    const r = await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "I want to save $5,000 for a car by June 2030 and I spent $42 on groceries at Safeway today" } });
    for (const a of r.json.message.actions) expect((await call(apply, "/x", { cookie: u.cookie, method: "POST", params: { id: a.id } })).status).toBe(200);
    const goals = (await call(listGoals, "/api/goals", { cookie: u.cookie })).json.goals;
    expect(goals[0]).toMatchObject({ name: "Car", kind: "CAR", targetCents: 500000 });
    const t = await db.transaction.findFirstOrThrow({ where: { userId: await userId(u.email) }, include: { category: true } });
    expect(t.merchant).toBe("Safeway");
    expect(t.amount.toString()).toBe("-42");
    expect(t.category?.slug).toBe("food");
  });

  it("validates dashboard layouts", async () => {
    const u = await newUser(register);
    expect((await call(patchLayout, "/x", { cookie: u.cookie, method: "PATCH", body: { layout: ["goals", "nope"] } })).status).toBe(422);
    const ok = await call(patchLayout, "/x", { cookie: u.cookie, method: "PATCH", body: { layout: ["goals", "metrics", "goals"] } });
    expect(ok.json.layout).toEqual(["goals", "metrics"]);
  });
});
