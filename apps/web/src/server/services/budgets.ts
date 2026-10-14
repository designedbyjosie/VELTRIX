import type { z } from "zod";
import { summarizeBudget, projectMonthEnd, type budgetCreateSchema, type budgetUpdateSchema } from "@veltrix/shared";
import { db } from "../db";
import { cents, decStr } from "../money";
import { badRequest, notFound } from "../errors";
import { daysInMonth, fromYmd, monthRange, monthStart, todayIn, ymd } from "../dates";
import { assertCategory } from "./categories";

/** Spending per category id for a month (positive cents, transfers/inflows excluded). */
export async function spendingByCategoryId(userId: string, ym: string, currency = "USD") {
  const range = monthRange(ym);
  const rows = await db.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, currency, date: range, amount: { lt: 0 }, NOT: { category: { kind: "TRANSFER" } } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.categoryId, -cents(r._sum.amount)]));
}

export async function budgetStatusForMonth(userId: string, ym: string, timezone = "UTC") {
  const [budgets, spend] = await Promise.all([
    db.budget.findMany({
      where: {
        userId,
        AND: [
          { OR: [{ startMonth: fromYmd(monthStart(ym)) }, { recurring: true, startMonth: { lte: fromYmd(monthStart(ym)) } }] },
          { OR: [{ archivedAt: null }, { archivedAt: { gt: fromYmd(monthStart(ym)) } }] },
        ],
      },
      include: { lines: { include: { category: true } } },
      orderBy: { createdAt: "asc" },
    }),
    spendingByCategoryId(userId, ym),
  ]);
  const today = todayIn(timezone);
  const isCurrent = today.slice(0, 7) === ym;
  const day = isCurrent ? Number(today.slice(8, 10)) : daysInMonth(ym);
  return budgets.map((b) => {
    const summary = summarizeBudget(
      b.lines.map((l) => ({ categoryId: l.categoryId, limitCents: cents(l.limitAmount), spentCents: spend.get(l.categoryId) ?? 0, alertThreshold: l.alertThreshold })),
    );
    return {
      id: b.id,
      name: b.name,
      recurring: b.recurring,
      startMonth: ymd(b.startMonth).slice(0, 7),
      currency: b.currency,
      archived: !!b.archivedAt,
      source: b.source,
      month: ym,
      ...summary,
      projectedCents: isCurrent ? projectMonthEnd(summary.spentCents, day, daysInMonth(ym)) : summary.spentCents,
      lines: summary.lines.map((s) => {
        const line = b.lines.find((l) => l.categoryId === s.categoryId)!;
        return { ...s, lineId: line.id, category: { id: line.category.id, name: line.category.name, slug: line.category.slug, color: line.category.color } };
      }),
    };
  });
}

export async function createBudget(userId: string, input: z.infer<typeof budgetCreateSchema>) {
  const ids = new Set<string>();
  for (const l of input.lines) {
    if (ids.has(l.categoryId)) throw badRequest("Each category can appear only once in a budget.");
    ids.add(l.categoryId);
    const cat = await assertCategory(userId, l.categoryId);
    if (cat?.kind !== "EXPENSE") throw badRequest(`"${cat?.name}" isn't a spending category.`);
  }
  return db.budget.create({
    data: {
      userId,
      name: input.name,
      startMonth: fromYmd(monthStart(input.month)),
      recurring: input.recurring,
      lines: { create: input.lines.map((l) => ({ categoryId: l.categoryId, limitAmount: decStr(l.limit), alertThreshold: l.alertThreshold })) },
    },
  });
}

export async function updateBudget(userId: string, id: string, input: z.infer<typeof budgetUpdateSchema>) {
  const b = await db.budget.findFirst({ where: { id, userId } });
  if (!b) throw notFound("Budget");
  if (input.lines) {
    for (const l of input.lines) await assertCategory(userId, l.categoryId);
  }
  return db.$transaction(async (tx) => {
    if (input.lines) {
      await tx.budgetCategory.deleteMany({ where: { budgetId: id } });
      await tx.budgetCategory.createMany({ data: input.lines.map((l) => ({ budgetId: id, categoryId: l.categoryId, limitAmount: decStr(l.limit), alertThreshold: l.alertThreshold })) });
    }
    return tx.budget.update({
      where: { id },
      data: {
        name: input.name,
        recurring: input.recurring,
        startMonth: input.month ? fromYmd(monthStart(input.month)) : undefined,
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
      },
    });
  });
}

export async function deleteBudget(userId: string, id: string) {
  const b = await db.budget.findFirst({ where: { id, userId } });
  if (!b) throw notFound("Budget");
  await db.budget.delete({ where: { id } });
}

export async function listArchivedBudgets(userId: string) {
  return db.budget.findMany({ where: { userId, archivedAt: { not: null } }, select: { id: true, name: true, archivedAt: true } });
}

