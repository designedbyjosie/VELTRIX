import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { categorize, parseTransactionsCsv, toCents, type transactionCreateSchema, type transactionQuerySchema, type transactionUpdateSchema } from "@veltrix/shared";
import { db } from "../db";
import { cents, decStr, dec } from "../money";
import { notFound, badRequest } from "../errors";
import { fromYmd, ymd } from "../dates";
import { sha256, randomToken } from "../auth/crypto";
import { assertCategory, categoryBySlug } from "./categories";
import { getAccount } from "./accounts";

export function serializeTxn(t: Prisma.TransactionGetPayload<{ include: { category: true; account: true } }>) {
  return {
    id: t.id,
    date: ymd(t.date),
    amountCents: cents(t.amount),
    currency: t.currency,
    merchant: t.merchant,
    description: t.description,
    notes: t.notes,
    category: t.category ? { id: t.category.id, slug: t.category.slug, name: t.category.name, color: t.category.color, kind: t.category.kind } : null,
    categorySource: t.categorySource,
    account: t.account ? { id: t.account.id, name: t.account.name, mask: t.account.mask } : null,
    source: t.source,
    importBatchId: t.importBatchId,
    createdAt: t.createdAt.toISOString(),
  };
}
export type SerializedTxn = ReturnType<typeof serializeTxn>;

export async function listTransactions(userId: string, q: z.infer<typeof transactionQuerySchema>) {
  const where: Prisma.TransactionWhereInput = { userId };
  if (q.q) where.OR = [{ merchant: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }, { notes: { contains: q.q, mode: "insensitive" } }];
  if (q.categoryId) where.categoryId = q.categoryId === "uncategorized" ? null : q.categoryId;
  if (q.accountId) where.accountId = q.accountId;
  if (q.from || q.to) where.date = { ...(q.from ? { gte: fromYmd(q.from) } : {}), ...(q.to ? { lte: fromYmd(q.to) } : {}) };
  const amount: Prisma.DecimalFilter = {};
  if (q.type === "income") amount.gt = 0;
  if (q.type === "expense") amount.lt = 0;
  if (Object.keys(amount).length) where.amount = amount;
  // min/max filter on absolute value
  const and: Prisma.TransactionWhereInput[] = [];
  if (q.min) and.push({ OR: [{ amount: { gte: decStr(q.min) } }, { amount: { lte: decStr(q.min).neg() } }] });
  if (q.max) and.push({ amount: { gte: decStr(q.max).neg(), lte: decStr(q.max) } });
  if (and.length) where.AND = and;

  const [total, rows, totals] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      include: { category: true, account: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.transaction.groupBy({ by: ["currency"], where, _sum: { amount: true } }),
  ]);
  return {
    items: rows.map(serializeTxn),
    total,
    page: q.page,
    pageSize: q.pageSize,
    pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
    netByCurrency: totals.map((t) => ({ currency: t.currency, netCents: cents(t._sum.amount) })),
  };
}

export async function getTransaction(userId: string, id: string) {
  const t = await db.transaction.findFirst({ where: { id, userId }, include: { category: true, account: true, importBatch: true } });
  if (!t) throw notFound("Transaction");
  return t;
}

export async function createTransaction(userId: string, input: z.infer<typeof transactionCreateSchema>) {
  if (input.accountId) await getAccount(userId, input.accountId);
  let categoryId = input.categoryId ?? null;
  let categorySource: "USER" | "RULE" = "USER";
  if (categoryId) await assertCategory(userId, categoryId);
  else {
    const slugMap = await categoryBySlug(userId);
    const r = categorize(input.merchant, input.description, toCents(input.amount));
    categoryId = slugMap.get(r.slug)?.id ?? null;
    categorySource = "RULE";
  }
  const t = await db.transaction.create({
    data: {
      userId,
      accountId: input.accountId ?? null,
      date: fromYmd(input.date),
      amount: decStr(input.amount),
      currency: input.currency,
      merchant: input.merchant,
      description: input.description,
      notes: input.notes,
      categoryId,
      categorySource,
      source: "MANUAL",
      // Manual entries are never deduplicated: two identical coffees are two coffees.
      dedupeHash: `manual:${randomToken(12)}`,
    },
    include: { category: true, account: true },
  });
  return serializeTxn(t);
}

export async function updateTransaction(userId: string, id: string, input: z.infer<typeof transactionUpdateSchema>) {
  await getTransaction(userId, id);
  if (input.accountId) await getAccount(userId, input.accountId);
  if (input.categoryId) await assertCategory(userId, input.categoryId);
  const t = await db.transaction.update({
    where: { id },
    data: {
      date: input.date ? fromYmd(input.date) : undefined,
      amount: input.amount ? decStr(input.amount) : undefined,
      merchant: input.merchant,
      description: input.description,
      notes: input.notes,
      currency: input.currency,
      accountId: input.accountId === undefined ? undefined : input.accountId,
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId, categorySource: "USER" as const } : {}),
    },
    include: { category: true, account: true },
  });
  return serializeTxn(t);
}

export async function deleteTransaction(userId: string, id: string) {
  await getTransaction(userId, id);
  await db.transaction.delete({ where: { id } });
}

/** Stable idempotency key for an imported row. */
export function importDedupeHash(userId: string, accountId: string | null, row: { date: string; amountCents: number; merchant: string; occurrence: number }) {
  return `csv:${sha256([userId, accountId ?? "-", row.date, row.amountCents, row.merchant.trim().toLowerCase(), row.occurrence].join("|"))}`;
}

export async function importCsv(
  userId: string,
  input: { filename: string; content: string; accountId?: string | null; invertSign?: boolean; dryRun?: boolean },
) {
  if (input.accountId) await getAccount(userId, input.accountId);
  const parsed = parseTransactionsCsv(input.content, undefined);
  if (!parsed.mapping) throw badRequest(parsed.errors[0]?.message ?? "Couldn't read this CSV.", { errors: parsed.errors });
  let rows = parsed.rows;
  if (input.invertSign) rows = rows.map((r) => ({ ...r, amountCents: -r.amountCents }));
  const slugMap = await categoryBySlug(userId);
  const nameMap = new Map([...slugMap.values()].map((c) => [c.name.toLowerCase(), c]));

  const prepared = rows.map((r) => {
    const fromFile = r.category ? slugMap.get(r.category) ?? nameMap.get(r.category) : undefined;
    const rule = categorize(r.merchant, r.description, r.amountCents);
    return {
      row: r,
      hash: importDedupeHash(userId, input.accountId ?? null, r),
      categoryId: fromFile?.id ?? slugMap.get(rule.slug)?.id ?? null,
      categorySource: fromFile ? ("IMPORT" as const) : ("RULE" as const),
    };
  });
  const existing = await db.transaction.findMany({ where: { userId, dedupeHash: { in: prepared.map((p) => p.hash) } }, select: { dedupeHash: true } });
  const existingSet = new Set(existing.map((e) => e.dedupeHash));
  const fresh = prepared.filter((p) => !existingSet.has(p.hash));

  const summary = {
    rowCount: rows.length + parsed.errors.length,
    importable: fresh.length,
    duplicates: prepared.length - fresh.length,
    errors: parsed.errors.slice(0, 50),
    errorCount: parsed.errors.length,
    preview: fresh.slice(0, 10).map((p) => ({ date: p.row.date, merchant: p.row.merchant, amountCents: p.row.amountCents, category: [...slugMap.values()].find((c) => c.id === p.categoryId)?.name ?? null })),
  };
  if (input.dryRun) return { ...summary, batchId: null, imported: 0 };

  const batch = await db.importBatch.create({
    data: { userId, filename: input.filename, accountId: input.accountId ?? null, rowCount: summary.rowCount, importedCount: 0, duplicateCount: summary.duplicates, errorCount: summary.errorCount },
  });
  const created = await db.transaction.createMany({
    data: fresh.map((p) => ({
      userId,
      accountId: input.accountId ?? null,
      date: fromYmd(p.row.date),
      amount: dec(p.row.amountCents),
      currency: "USD",
      merchant: p.row.merchant,
      description: p.row.description,
      categoryId: p.categoryId,
      categorySource: p.categorySource,
      source: "CSV" as const,
      importBatchId: batch.id,
      dedupeHash: p.hash,
    })),
    skipDuplicates: true, // concurrent imports still can't duplicate thanks to the unique index
  });
  await db.importBatch.update({ where: { id: batch.id }, data: { importedCount: created.count, duplicateCount: summary.duplicates + (fresh.length - created.count) } });
  return { ...summary, batchId: batch.id, imported: created.count };
}

/** Lightweight rows for analytics over a date range. */
export async function txnsForRange(userId: string, from: string, toExclusive: string, currency?: string) {
  const rows = await db.transaction.findMany({
    where: { userId, date: { gte: fromYmd(from), lt: fromYmd(toExclusive) }, ...(currency ? { currency } : {}) },
    select: { id: true, date: true, amount: true, merchant: true, categoryId: true, category: { select: { slug: true, kind: true, name: true } } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    date: ymd(r.date),
    amountCents: cents(r.amount),
    merchant: r.merchant,
    categoryId: r.categoryId,
    categorySlug: r.category?.slug ?? null,
    categoryKind: r.category?.kind ?? null,
    categoryName: r.category?.name ?? "Uncategorized",
  }));
}
