import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createAccount } from "@/app/api/accounts/route";
import { GET as listTxns, POST as createTxn } from "@/app/api/transactions/route";
import { PATCH as patchTxn } from "@/app/api/transactions/[id]/route";
import { POST as importCsv } from "@/app/api/transactions/import/route";
import { GET as listCategories } from "@/app/api/categories/route";
import { GET as getBudgets, POST as createBudget } from "@/app/api/budgets/route";
import { GET as listGoals, POST as createGoal } from "@/app/api/goals/route";
import { POST as contribute } from "@/app/api/goals/[id]/contributions/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { db } from "@/server/db";
import { netWorthNow } from "@/server/services/accounts";
import { todayIn } from "@/server/dates";
import { call, newUser } from "./helpers";

const today = todayIn("UTC");
const month = today.slice(0, 7);

describe("transactions", () => {
  it("auto-categorizes manual entries and lets the user recategorize", async () => {
    const u = await newUser(register);
    const r = await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: today, amount: "-5.75", merchant: "Starbucks #42" } });
    expect(r.json.transaction.category.slug).toBe("food");
    expect(r.json.transaction.categorySource).toBe("RULE");
    const cats = (await call(listCategories, "/api/categories", { cookie: u.cookie })).json.categories;
    const shopping = cats.find((c: { slug: string }) => c.slug === "shopping");
    const p = await call(patchTxn, "/api/transactions/x", { cookie: u.cookie, method: "PATCH", params: { id: r.json.transaction.id }, body: { categoryId: shopping.id } });
    expect(p.json.transaction.category.slug).toBe("shopping");
    expect(p.json.transaction.categorySource).toBe("USER");
  });

  it("validates input", async () => {
    const u = await newUser(register);
    const r = await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: "10/01/2026", amount: "12.345", merchant: "" } });
    expect(r.status).toBe(422);
    expect(r.json.error.fields.map((f: { path: string }) => f.path).sort()).toEqual(["amount", "date", "merchant"]);
  });

  it("imports CSV idempotently: re-importing the same file creates no duplicates", async () => {
    const u = await newUser(register);
    const csv = ["Date,Description,Amount", `${today},Coffee Shop,-4.50`, `${today},Coffee Shop,-4.50`, `${today},ACME Payroll,2500.00`, "bad,row,1"].join("\n");
    const preview = await call(importCsv, "/api/transactions/import", { cookie: u.cookie, body: { filename: "bank.csv", content: csv, dryRun: true } });
    expect(preview.json.importable).toBe(3);
    expect(preview.json.errorCount).toBe(1);
    expect(await db.transaction.count({ where: { user: { email: u.email } } })).toBe(0);
    const first = await call(importCsv, "/api/transactions/import", { cookie: u.cookie, body: { filename: "bank.csv", content: csv } });
    expect(first.json.imported).toBe(3);
    const second = await call(importCsv, "/api/transactions/import", { cookie: u.cookie, body: { filename: "bank.csv", content: csv } });
    expect(second.json.imported).toBe(0);
    expect(second.json.duplicates).toBe(3);
    const list = await call(listTxns, "/api/transactions", { cookie: u.cookie });
    expect(list.json.total).toBe(3);
    expect(list.json.items.every((t: { source: string; importBatchId: string }) => t.source === "CSV" && t.importBatchId)).toBe(true);
  });

  it("filters by type, text and amount", async () => {
    const u = await newUser(register);
    for (const [m, a] of [["Rent", "-1500.00"], ["Coffee", "-4.00"], ["Salary", "3000.00"]] as const) await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: today, amount: a, merchant: m } });
    expect((await call(listTxns, "/api/transactions", { cookie: u.cookie, query: { type: "income" } })).json.total).toBe(1);
    expect((await call(listTxns, "/api/transactions", { cookie: u.cookie, query: { q: "coff" } })).json.items[0].merchant).toBe("Coffee");
    expect((await call(listTxns, "/api/transactions", { cookie: u.cookie, query: { min: "100.00", type: "expense" } })).json.total).toBe(1);
  });
});

describe("budgets, goals and net worth", () => {
  it("computes budget usage from transactions and excludes transfers", async () => {
    const u = await newUser(register);
    const cats = (await call(listCategories, "/api/categories", { cookie: u.cookie })).json.categories;
    const food = cats.find((c: { slug: string }) => c.slug === "food");
    const income = cats.find((c: { slug: string }) => c.slug === "income");
    expect((await call(createBudget, "/api/budgets", { cookie: u.cookie, body: { name: "Plan", month, lines: [{ categoryId: income.id, limit: "100.00" }] } })).status).toBe(400);
    expect((await call(createBudget, "/api/budgets", { cookie: u.cookie, body: { name: "Plan", month, lines: [{ categoryId: food.id, limit: "100.00", alertThreshold: 80 }] } })).status).toBe(200);
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: `${month}-01`, amount: "-85.00", merchant: "Grocery", categoryId: food.id } });
    const b = await call(getBudgets, "/api/budgets", { cookie: u.cookie, query: { month } });
    const line = b.json.budgets[0].lines[0];
    expect(line.spentCents).toBe(8500);
    expect(line.remainingCents).toBe(1500);
    expect(line.health).toBe("warning");
    // Recurring budgets apply to later months too.
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    const later = await call(getBudgets, "/api/budgets", { cookie: u.cookie, query: { month: next } });
    expect(later.json.budgets).toHaveLength(1);
    expect(later.json.budgets[0].spentCents).toBe(0);
  });

  it("tracks goal contributions and projections", async () => {
    const u = await newUser(register);
    const g = await call(createGoal, "/api/goals", { cookie: u.cookie, body: { name: "Emergency", kind: "EMERGENCY_FUND", target: "1000.00", startingAmount: "100.00", plannedMonthly: "100.00" } });
    await call(contribute, "/api/goals/x/contributions", { cookie: u.cookie, params: { id: g.json.goal.id }, body: { amount: "150.00", date: today } });
    const goals = (await call(listGoals, "/api/goals", { cookie: u.cookie })).json.goals;
    expect(goals[0].savedCents).toBe(25000);
    expect(goals[0].projection.percent).toBe(25);
    expect(goals[0].projection.remainingCents).toBe(75000);
  });

  it("calculates net worth as assets minus liabilities", async () => {
    const u = await newUser(register);
    await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Checking", type: "CHECKING", balance: "5000.00" } });
    await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Card", type: "CREDIT_CARD", balance: "1200.50" } });
    await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Mortgage", type: "MORTGAGE", balance: "200000.00" } });
    await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Home", type: "PROPERTY", balance: "350000.00" } });
    const user = await db.user.findUniqueOrThrow({ where: { email: u.email } });
    const nw = await netWorthNow(user.id);
    expect(nw.netWorthCents).toBe(500000 + 35000000 - 120050 - 20000000);
  });
});

describe("AI advisor without credentials", () => {
  it("answers supported questions from the user's data and labels the mode", async () => {
    const u = await newUser(register);
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: today, amount: "-120.00", merchant: "Whole Foods Market" } });
    const r = await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "Where did my money go this month?" } });
    expect(r.status).toBe(200);
    expect(r.json.status.mode).toBe("builtin");
    expect(r.json.status.reason).toBe("not_configured");
    expect(r.json.message.content).toContain("$120.00");
    expect(r.json.message.evidence.tools[0].name).toBe("get_spending_summary");
  });
});
