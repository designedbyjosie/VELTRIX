/**
 * Guided setup: one request saves the accounts, income, budget and goal a user
 * entered in the setup wizard. Bank-connected users get suggestions computed from
 * their imported transactions.
 */
import type { z } from "zod";
import type { setupSchema } from "@veltrix/shared";
import { db } from "../db";
import { cents, decStr } from "../money";
import { addMonths, fromYmd, monthStart, todayIn } from "../dates";
import { createAccount } from "./accounts";
import { activeBudgetId, createBudget, updateBudget } from "./budgets";
import { categoryBySlug } from "./categories";
import { createGoal } from "./goals";

interface Ctx {
  timezone: string;
  currency: string;
}

export async function completeSetup(userId: string, input: z.infer<typeof setupSchema>, ctx: Ctx) {
  for (const a of input.accounts) {
    await createAccount(userId, { name: a.name, type: a.type, balance: a.balance, institution: "", currency: ctx.currency, mask: "" });
  }
  const ym = todayIn(ctx.timezone).slice(0, 7);
  if (input.budget.length) {
    const slugs = await categoryBySlug(userId);
    const lines = input.budget.map((l) => ({ categoryId: slugs.get(l.category)!.id, limit: l.limit, alertThreshold: 80 }));
    const existing = await activeBudgetId(userId, ym);
    if (existing) await updateBudget(userId, existing, { lines });
    else await createBudget(userId, { name: "Monthly budget", month: ym, recurring: true, lines });
  }
  if (input.goal) {
    await createGoal(userId, { ...input.goal, targetDate: input.goal.targetDate ?? null, plannedMonthly: input.goal.plannedMonthly ?? null, currency: ctx.currency });
  }
  await db.userProfile.update({
    where: { userId },
    data: {
      ...(input.monthlyIncome !== undefined ? { monthlyIncome: input.monthlyIncome === null ? null : decStr(input.monthlyIncome) } : {}),
      setupPath: input.path,
      onboardingCompletedAt: new Date(),
    },
  });
  return { ok: true };
}

/** Prefill values for the wizard from the user's existing records (e.g. a just-linked bank). */
export async function setupSuggestions(userId: string, ctx: Ctx) {
  const thisMonth = todayIn(ctx.timezone).slice(0, 7);
  const from = fromYmd(monthStart(addMonths(thisMonth, -3)));
  const to = fromYmd(monthStart(thisMonth));
  const [rows, earliest, accounts, profile] = await Promise.all([
    db.transaction.groupBy({ by: ["categoryId"], where: { userId, currency: ctx.currency, date: { gte: from, lt: to } }, _sum: { amount: true } }),
    db.transaction.findFirst({ where: { userId, date: { gte: from, lt: to } }, orderBy: { date: "asc" }, select: { date: true } }),
    db.connectedAccount.findMany({ where: { userId, archivedAt: null }, select: { id: true, name: true, type: true, source: true, currentBalance: true } }),
    db.userProfile.findUnique({ where: { userId }, select: { monthlyIncome: true } }),
  ]);
  // Average over the full months actually covered by data (1–3).
  const months = earliest ? Math.max(1, Math.min(3, Math.round((to.getTime() - earliest.date.getTime()) / (30.44 * 86_400_000)))) : 0;
  const slugs = await categoryBySlug(userId);
  const byId = new Map([...slugs.values()].map((c) => [c.id, c]));
  const spending: Record<string, number> = {};
  let incomeCents = 0;
  for (const r of rows) {
    const cat = r.categoryId ? byId.get(r.categoryId) : null;
    const total = cents(r._sum.amount);
    if (cat?.kind === "INCOME" && total > 0) incomeCents += total;
    else if (cat?.kind === "EXPENSE" || (!cat && total < 0)) {
      const slug = cat?.slug ?? "other";
      spending[slug] = (spending[slug] ?? 0) - total;
    }
  }
  const avg = (c: number) => (months ? Math.round(c / months / 100) * 100 : 0);
  return {
    monthsOfHistory: months,
    monthlyIncomeCents: profile?.monthlyIncome ? cents(profile.monthlyIncome) : months ? avg(incomeCents) : null,
    monthlySpendingCents: Object.fromEntries(Object.entries(spending).map(([k, v]) => [k, avg(v)]).filter(([, v]) => (v as number) > 0)),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, linked: a.source === "AGGREGATOR", balanceCents: cents(a.currentBalance) })),
  };
}
