import { detectRecurring } from "@veltrix/shared";
import { db } from "../db";
import { cents, dec } from "../money";
import { notFound } from "../errors";
import { addDays, fromYmd, todayIn, ymd } from "../dates";

/**
 * Re-run recurring-charge detection over the last 13 months. New candidates are stored
 * as SUSPECTED; user decisions (CONFIRMED / DISMISSED) are never overwritten.
 */
export async function refreshRecurring(userId: string, timezone = "UTC") {
  const today = todayIn(timezone);
  const rows = await db.transaction.findMany({
    where: { userId, amount: { lt: 0 }, date: { gte: fromYmd(addDays(today, -400)) }, NOT: { category: { kind: "TRANSFER" } } },
    select: { date: true, merchant: true, amount: true, categoryId: true, currency: true },
  });
  const candidates = detectRecurring(rows.map((r) => ({ date: ymd(r.date), merchant: r.merchant, amountCents: cents(r.amount) })));
  for (const c of candidates) {
    const sample = rows.find((r) => r.merchant === c.merchant);
    await db.recurringPayment.upsert({
      where: { userId_merchantKey: { userId, merchantKey: c.merchantKey } },
      create: {
        userId,
        merchant: c.merchant,
        merchantKey: c.merchantKey,
        amount: dec(c.typicalAmountCents),
        currency: sample?.currency ?? "USD",
        frequency: c.frequency,
        occurrences: c.occurrences,
        lastObservedAt: fromYmd(c.lastObserved),
        nextExpectedAt: fromYmd(c.nextExpected),
        confidence: c.confidence,
        categoryId: sample?.categoryId ?? null,
        evidence: c.evidence,
        status: "SUSPECTED",
      },
      update: {
        amount: dec(c.typicalAmountCents),
        frequency: c.frequency,
        occurrences: c.occurrences,
        lastObservedAt: fromYmd(c.lastObserved),
        nextExpectedAt: fromYmd(c.nextExpected),
        confidence: c.confidence,
        evidence: c.evidence,
      },
    });
  }
  return candidates.length;
}

export async function listRecurring(userId: string) {
  const rows = await db.recurringPayment.findMany({ where: { userId }, include: { category: true }, orderBy: [{ status: "asc" }, { amount: "desc" }] });
  const perYear = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1, UNKNOWN: 0 } as const;
  return rows.map((r) => ({
    id: r.id,
    merchant: r.merchant,
    amountCents: cents(r.amount),
    currency: r.currency,
    frequency: r.frequency,
    occurrences: r.occurrences,
    lastObserved: ymd(r.lastObservedAt),
    nextExpected: r.nextExpectedAt ? ymd(r.nextExpectedAt) : null,
    estimatedAnnualCents: cents(r.amount) * perYear[r.frequency],
    confidence: r.confidence,
    status: r.status,
    category: r.category ? { name: r.category.name, slug: r.category.slug } : null,
    evidence: (r.evidence as { date: string; amountCents: number }[] | null) ?? [],
  }));
}

export async function setRecurringStatus(userId: string, id: string, status: "CONFIRMED" | "DISMISSED" | "SUSPECTED") {
  const r = await db.recurringPayment.findFirst({ where: { id, userId } });
  if (!r) throw notFound("Recurring payment");
  return db.recurringPayment.update({ where: { id }, data: { status } });
}
