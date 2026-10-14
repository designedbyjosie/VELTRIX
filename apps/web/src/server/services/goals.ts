import type { z } from "zod";
import { projectGoal, type contributionSchema, type goalCreateSchema, type goalUpdateSchema } from "@veltrix/shared";
import { db } from "../db";
import { cents, centsOrNull, decStr } from "../money";
import { notFound } from "../errors";
import { fromYmd, todayIn, ymd } from "../dates";

export async function listGoals(userId: string, timezone = "UTC", includeArchived = false) {
  const goals = await db.savingsGoal.findMany({
    where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
    include: { contributions: { orderBy: { date: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
  const today = todayIn(timezone);
  return goals.map((g) => {
    const contributed = g.contributions.reduce((s, c) => s + cents(c.amount), 0);
    const saved = cents(g.startingAmount) + contributed;
    const projection = projectGoal({
      targetCents: cents(g.targetAmount),
      savedCents: saved,
      targetDate: g.targetDate ? ymd(g.targetDate) : null,
      plannedMonthlyCents: centsOrNull(g.plannedMonthly),
      today,
    });
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      currency: g.currency,
      targetCents: cents(g.targetAmount),
      startingCents: cents(g.startingAmount),
      savedCents: saved,
      targetDate: g.targetDate ? ymd(g.targetDate) : null,
      plannedMonthlyCents: centsOrNull(g.plannedMonthly),
      archived: !!g.archivedAt,
      source: g.source,
      projection,
      contributions: g.contributions.slice(0, 20).map((c) => ({ id: c.id, amountCents: cents(c.amount), date: ymd(c.date), note: c.note })),
    };
  });
}

async function getGoal(userId: string, id: string) {
  const g = await db.savingsGoal.findFirst({ where: { id, userId } });
  if (!g) throw notFound("Goal");
  return g;
}

export async function createGoal(userId: string, input: z.infer<typeof goalCreateSchema>) {
  return db.savingsGoal.create({
    data: {
      userId,
      name: input.name,
      kind: input.kind,
      currency: input.currency,
      targetAmount: decStr(input.target),
      startingAmount: decStr(input.startingAmount),
      targetDate: input.targetDate ? fromYmd(input.targetDate) : null,
      plannedMonthly: input.plannedMonthly ? decStr(input.plannedMonthly) : null,
    },
  });
}

export async function updateGoal(userId: string, id: string, input: z.infer<typeof goalUpdateSchema>) {
  await getGoal(userId, id);
  return db.savingsGoal.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind,
      targetAmount: input.target ? decStr(input.target) : undefined,
      startingAmount: input.startingAmount ? decStr(input.startingAmount) : undefined,
      targetDate: input.targetDate === undefined ? undefined : input.targetDate ? fromYmd(input.targetDate) : null,
      plannedMonthly: input.plannedMonthly === undefined ? undefined : input.plannedMonthly ? decStr(input.plannedMonthly) : null,
      ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
    },
  });
}

export async function deleteGoal(userId: string, id: string) {
  await getGoal(userId, id);
  await db.savingsGoal.delete({ where: { id } });
}

export async function addContribution(userId: string, goalId: string, input: z.infer<typeof contributionSchema>) {
  await getGoal(userId, goalId);
  return db.goalContribution.create({ data: { userId, goalId, amount: decStr(input.amount), date: fromYmd(input.date), note: input.note } });
}

export async function deleteContribution(userId: string, goalId: string, contributionId: string) {
  const c = await db.goalContribution.findFirst({ where: { id: contributionId, goalId, userId } });
  if (!c) throw notFound("Contribution");
  await db.goalContribution.delete({ where: { id: c.id } });
}
