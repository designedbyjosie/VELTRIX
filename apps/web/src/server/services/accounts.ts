import type { z } from "zod";
import { calculateNetWorth, isLiability, type accountCreateSchema, type accountUpdateSchema, type AccountType } from "@veltrix/shared";
import { db } from "../db";
import { cents, decStr } from "../money";
import { notFound } from "../errors";
import { ymd, fromYmd, todayIn } from "../dates";
import { fxRate } from "../providers/fx";

export async function listAccounts(userId: string, includeArchived = false) {
  const rows = await db.connectedAccount.findMany({
    where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    type: a.type,
    source: a.source,
    mask: a.mask,
    currency: a.currency,
    balanceCents: cents(a.currentBalance),
    isLiability: isLiability(a.type as AccountType),
    balanceAsOf: a.balanceAsOf.toISOString(),
    archived: !!a.archivedAt,
  }));
}

export async function getAccount(userId: string, id: string) {
  const a = await db.connectedAccount.findFirst({ where: { id, userId } });
  if (!a) throw notFound("Account");
  return a;
}

async function recordBalance(userId: string, accountId: string, balance: string, timezone = "UTC") {
  const asOf = fromYmd(todayIn(timezone));
  await db.accountBalance.upsert({
    where: { accountId_asOf: { accountId, asOf } },
    create: { userId, accountId, asOf, balance: decStr(balance) },
    update: { balance: decStr(balance) },
  });
}

export async function createAccount(userId: string, input: z.infer<typeof accountCreateSchema>) {
  const a = await db.connectedAccount.create({
    data: {
      userId,
      name: input.name,
      institution: input.institution,
      type: input.type,
      currency: input.currency,
      mask: input.mask,
      currentBalance: decStr(input.balance),
      source: "MANUAL",
    },
  });
  await recordBalance(userId, a.id, input.balance);
  return a;
}

export async function updateAccount(userId: string, id: string, input: z.infer<typeof accountUpdateSchema>) {
  await getAccount(userId, id);
  const a = await db.connectedAccount.update({
    where: { id },
    data: {
      name: input.name,
      institution: input.institution,
      type: input.type,
      currency: input.currency,
      mask: input.mask,
      ...(input.balance !== undefined ? { currentBalance: decStr(input.balance), balanceAsOf: new Date() } : {}),
      ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
    },
  });
  if (input.balance !== undefined) await recordBalance(userId, id, input.balance);
  return a;
}

export async function deleteAccount(userId: string, id: string) {
  await getAccount(userId, id);
  await db.connectedAccount.delete({ where: { id } });
}

/**
 * Net worth in the base currency. Foreign-currency balances are converted with the
 * latest ECB reference rate when available; otherwise they are excluded and counted.
 */
export async function netWorthNow(userId: string, baseCurrency = "USD") {
  const accounts = await listAccounts(userId);
  const foreign = [...new Set(accounts.filter((a) => a.currency !== baseCurrency).map((a) => a.currency))];
  const rates = new Map((await Promise.all(foreign.map(async (c) => [c, await fxRate(c, baseCurrency).catch(() => null)] as const))).filter(([, r]) => r !== null));
  const converted = accounts.map((a) => {
    const r = rates.get(a.currency);
    return r ? { type: a.type as AccountType, balanceCents: Math.round(a.balanceCents * r.rate), currency: baseCurrency } : { type: a.type as AccountType, balanceCents: a.balanceCents, currency: a.currency };
  });
  return {
    ...calculateNetWorth(converted, baseCurrency),
    accountCount: accounts.length,
    convertedForeignCurrency: accounts.filter((a) => rates.has(a.currency)).length,
    fxRates: [...rates.values()].map((r) => ({ from: r!.from, to: r!.to, rate: r!.rate, asOf: r!.asOf, source: r!.source })),
  };
}

/**
 * Net worth history from recorded balance snapshots. For each date, uses the most
 * recent known balance of every account (carry-forward).
 */
export async function netWorthHistory(userId: string, baseCurrency = "USD", sinceYmd?: string) {
  const accounts = await db.connectedAccount.findMany({ where: { userId, archivedAt: null, currency: baseCurrency }, select: { id: true, type: true } });
  const balances = await db.accountBalance.findMany({
    where: { userId, accountId: { in: accounts.map((a) => a.id) } },
    orderBy: { asOf: "asc" },
  });
  const typeOf = new Map(accounts.map((a) => [a.id, a.type as AccountType]));
  const dates = [...new Set(balances.map((b) => ymd(b.asOf)))].filter((d) => !sinceYmd || d >= sinceYmd).sort();
  const latest = new Map<string, number>();
  const points: { date: string; netWorthCents: number; assetsCents: number; liabilitiesCents: number }[] = [];
  let i = 0;
  const sorted = balances.map((b) => ({ accountId: b.accountId, date: ymd(b.asOf), cents: cents(b.balance) }));
  for (const d of dates) {
    while (i < sorted.length && sorted[i].date <= d) {
      latest.set(sorted[i].accountId, sorted[i].cents);
      i++;
    }
    const r = calculateNetWorth(
      [...latest.entries()].map(([id, c]) => ({ type: typeOf.get(id)!, balanceCents: c, currency: baseCurrency })),
      baseCurrency,
    );
    points.push({ date: d, netWorthCents: r.netWorthCents, assetsCents: r.assetsCents, liabilitiesCents: r.liabilitiesCents });
  }
  return points;
}
