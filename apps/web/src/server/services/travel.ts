import type { z } from "zod";
import type { travelExpenseSchema, tripCreateSchema, tripUpdateSchema } from "@veltrix/shared";
import { db } from "../db";
import { cents, centsOrNull, decStr } from "../money";
import { notFound } from "../errors";
import { fromYmd, ymd } from "../dates";

export async function listTrips(userId: string) {
  const trips = await db.travelPlan.findMany({ where: { userId }, include: { expenses: { orderBy: { createdAt: "desc" } } }, orderBy: [{ startDate: "asc" }, { createdAt: "desc" }] });
  return trips.map((t) => {
    const sameCurrency = t.expenses.filter((e) => e.currency === t.currency);
    const spent = sameCurrency.filter((e) => !e.isQuote).reduce((s, e) => s + cents(e.amount), 0);
    const quoted = sameCurrency.filter((e) => e.isQuote).reduce((s, e) => s + cents(e.amount), 0);
    const budget = centsOrNull(t.budget);
    const byCategory = new Map<string, number>();
    for (const e of sameCurrency.filter((x) => !x.isQuote)) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + cents(e.amount));
    return {
      id: t.id,
      name: t.name,
      destination: t.destination,
      startDate: t.startDate ? ymd(t.startDate) : null,
      endDate: t.endDate ? ymd(t.endDate) : null,
      budgetCents: budget,
      currency: t.currency,
      status: t.status,
      notes: t.notes,
      source: t.source,
      spentCents: spent,
      quotedCents: quoted,
      /** Spent + saved quotes: what the trip is on track to cost if quoted items are booked. */
      projectedCents: spent + quoted,
      remainingCents: budget !== null ? budget - spent : null,
      otherCurrencyCount: t.expenses.length - sameCurrency.length,
      byCategory: [...byCategory.entries()].map(([category, c]) => ({ category, cents: c })),
      expenses: t.expenses.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amountCents: cents(e.amount),
        currency: e.currency,
        date: e.date ? ymd(e.date) : null,
        provider: e.provider,
        isQuote: e.isQuote,
        sourceUrl: e.sourceUrl,
        source: e.source,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });
}

async function getTrip(userId: string, id: string) {
  const t = await db.travelPlan.findFirst({ where: { id, userId } });
  if (!t) throw notFound("Trip");
  return t;
}

export async function createTrip(userId: string, input: z.infer<typeof tripCreateSchema>) {
  return db.travelPlan.create({
    data: {
      userId,
      name: input.name,
      destination: input.destination,
      startDate: input.startDate ? fromYmd(input.startDate) : null,
      endDate: input.endDate ? fromYmd(input.endDate) : null,
      budget: input.budget ? decStr(input.budget) : null,
      currency: input.currency,
      notes: input.notes,
    },
  });
}

export async function updateTrip(userId: string, id: string, input: z.infer<typeof tripUpdateSchema>) {
  await getTrip(userId, id);
  return db.travelPlan.update({
    where: { id },
    data: {
      name: input.name,
      destination: input.destination,
      status: input.status,
      notes: input.notes,
      startDate: input.startDate === undefined ? undefined : input.startDate ? fromYmd(input.startDate) : null,
      endDate: input.endDate === undefined ? undefined : input.endDate ? fromYmd(input.endDate) : null,
      budget: input.budget === undefined ? undefined : input.budget ? decStr(input.budget) : null,
    },
  });
}

export async function deleteTrip(userId: string, id: string) {
  await getTrip(userId, id);
  await db.travelPlan.delete({ where: { id } });
}

export async function addTravelExpense(userId: string, tripId: string, input: z.infer<typeof travelExpenseSchema>, source: "MANUAL" | "EXTENSION" = "MANUAL") {
  await getTrip(userId, tripId);
  return db.travelExpense.create({
    data: {
      userId,
      tripId,
      category: input.category,
      description: input.description,
      amount: decStr(input.amount),
      currency: input.currency,
      date: input.date ? fromYmd(input.date) : null,
      provider: input.provider,
      isQuote: input.isQuote,
      sourceUrl: input.sourceUrl ?? null,
      source,
    },
  });
}

export async function deleteTravelExpense(userId: string, tripId: string, expenseId: string) {
  const e = await db.travelExpense.findFirst({ where: { id: expenseId, tripId, userId } });
  if (!e) throw notFound("Expense");
  await db.travelExpense.delete({ where: { id: e.id } });
}
