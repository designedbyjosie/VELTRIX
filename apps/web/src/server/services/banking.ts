/**
 * Bank connections via Plaid: link, import accounts and balances, sync transactions
 * incrementally (/transactions/sync with a stored cursor), and disconnect.
 * Access tokens are encrypted at rest and never leave the server.
 */
import { categorize, toCents, type AccountType } from "@veltrix/shared";
import { db } from "../db";
import { dec } from "../money";
import { notFound, HttpError } from "../errors";
import { fromYmd, todayIn } from "../dates";
import { open, seal } from "../crypto-box";
import { plaid, PlaidError, type PlaidAccount, type PlaidTransaction } from "../providers/plaid";
import { categoryBySlug } from "./categories";
import { refreshRecurring } from "./recurring";
import { audit } from "../audit";

export function mapAccountType(type: string, subtype: string | null): AccountType {
  const s = (subtype ?? "").toLowerCase();
  switch (type) {
    case "depository":
      return ["savings", "money market", "cd", "hsa", "cash management"].includes(s) ? "SAVINGS" : "CHECKING";
    case "credit":
      return "CREDIT_CARD";
    case "loan":
      return s === "mortgage" || s === "home equity" ? "MORTGAGE" : "LOAN";
    case "investment":
    case "brokerage":
      return /401|403|457|ira|roth|pension|retirement|sep|simple|tsp|keogh/.test(s) ? "RETIREMENT" : "INVESTMENT";
    default:
      return "OTHER_ASSET";
  }
}

/** Map Plaid's personal finance category to a VELTRIX category slug. */
export function mapCategory(t: Pick<PlaidTransaction, "personal_finance_category" | "merchant_name" | "name" | "amount">): string {
  const outflow = t.amount > 0;
  const rule = categorize(t.merchant_name ?? t.name, t.name, outflow ? -1 : 1).slug;
  if (rule === "subscriptions") return rule;
  const p = t.personal_finance_category?.primary ?? "";
  const d = t.personal_finance_category?.detailed ?? "";
  if (p === "INCOME") return "income";
  if (p === "TRANSFER_IN" || p === "TRANSFER_OUT") return "transfer";
  if (p === "LOAN_PAYMENTS") return d.includes("MORTGAGE") ? "housing" : "transfer";
  if (p === "RENT_AND_UTILITIES") return d.includes("RENT") ? "housing" : "utilities";
  const table: Record<string, string> = {
    FOOD_AND_DRINK: "food",
    GENERAL_MERCHANDISE: "shopping",
    HOME_IMPROVEMENT: "housing",
    MEDICAL: "health",
    PERSONAL_CARE: "health",
    TRANSPORTATION: "transport",
    TRAVEL: "travel",
    ENTERTAINMENT: "entertainment",
    BANK_FEES: "other",
    GOVERNMENT_AND_NON_PROFIT: "other",
    GENERAL_SERVICES: "other",
  };
  return table[p] ?? rule;
}

/** Plaid amounts are positive for money leaving the account; VELTRIX uses negative. */
const signedCents = (amount: number) => -toCents(amount.toFixed(2));
const currencyOf = (x: { iso_currency_code: string | null; unofficial_currency_code: string | null }) => (x.iso_currency_code ?? "USD").toUpperCase().slice(0, 3);

async function upsertAccounts(userId: string, itemDbId: string, institution: string, accounts: PlaidAccount[], timezone: string) {
  const asOf = fromYmd(todayIn(timezone));
  const ids = new Map<string, string>();
  for (const a of accounts) {
    const balance = a.balances.current ?? a.balances.available ?? 0;
    const data = {
      name: (a.official_name || a.name).slice(0, 80),
      institution: institution.slice(0, 80),
      type: mapAccountType(a.type, a.subtype),
      mask: (a.mask ?? "").replace(/\D/g, "").slice(-4),
      currency: currencyOf(a.balances),
      currentBalance: dec(toCents(Math.abs(balance).toFixed(2)) * (balance < 0 && a.type === "depository" ? -1 : 1)),
      balanceAsOf: new Date(),
      plaidItemId: itemDbId,
    };
    const acct = await db.connectedAccount.upsert({
      where: { userId_source_externalId: { userId, source: "AGGREGATOR", externalId: a.account_id } },
      create: { userId, source: "AGGREGATOR", externalId: a.account_id, ...data },
      update: data,
    });
    await db.accountBalance.upsert({
      where: { accountId_asOf: { accountId: acct.id, asOf } },
      create: { userId, accountId: acct.id, asOf, balance: data.currentBalance, source: "AGGREGATOR" },
      update: { balance: data.currentBalance },
    });
    ids.set(a.account_id, acct.id);
  }
  return ids;
}

export async function syncItem(userId: string, itemId: string, timezone = "UTC") {
  const item = await db.plaidItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw notFound("Bank connection");
  const accessToken = open(item.accessTokenEnc);
  try {
    const { accounts } = await plaid.accounts(accessToken);
    const accountIds = await upsertAccounts(userId, item.id, item.institutionName, accounts, timezone);
    const cats = await categoryBySlug(userId);

    // Collect all pages first; restart from the stored cursor if Plaid reports a mutation mid-pagination.
    let added: PlaidTransaction[] = [];
    let modified: PlaidTransaction[] = [];
    let removed: string[] = [];
    let cursor = item.cursor;
    for (let attempt = 0; attempt < 3; attempt++) {
      added = [];
      modified = [];
      removed = [];
      cursor = item.cursor;
      try {
        for (let page = 0; page < 50; page++) {
          const r = await plaid.sync(accessToken, cursor);
          added.push(...r.added);
          modified.push(...r.modified);
          removed.push(...r.removed.map((x) => x.transaction_id));
          cursor = r.next_cursor;
          if (!r.has_more) break;
        }
        break;
      } catch (e) {
        if (e instanceof PlaidError && e.code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" && attempt < 2) continue;
        throw e;
      }
    }

    const toRow = (t: PlaidTransaction) => {
      const slug = mapCategory(t);
      return {
        accountId: accountIds.get(t.account_id) ?? null,
        date: fromYmd(t.date),
        amount: dec(signedCents(t.amount)),
        currency: currencyOf(t),
        merchant: (t.merchant_name || t.name).slice(0, 140),
        description: t.name.slice(0, 280),
        categoryId: cats.get(slug)?.id ?? null,
      };
    };
    const posted = added.filter((x) => !x.pending && x.amount !== 0);
    // createMany + skipDuplicates keeps re-syncs idempotent (unique userId+dedupeHash).
    const created = await db.transaction.createMany({
      data: posted.map((t) => ({ userId, ...toRow(t), categorySource: "RULE" as const, source: "AGGREGATOR" as const, dedupeHash: `plaid:${t.transaction_id}` })),
      skipDuplicates: true,
    });
    const inserted = created.count;
    for (const t of modified.filter((x) => !x.pending && x.amount !== 0)) {
      const existing = await db.transaction.findUnique({ where: { userId_dedupeHash: { userId, dedupeHash: `plaid:${t.transaction_id}` } } });
      const row = toRow(t);
      if (existing) {
        // Keep the user's own category choice.
        await db.transaction.update({ where: { id: existing.id }, data: existing.categorySource === "USER" ? { ...row, categoryId: existing.categoryId } : row });
      } else {
        await db.transaction.create({ data: { userId, ...row, categorySource: "RULE", source: "AGGREGATOR", dedupeHash: `plaid:${t.transaction_id}` } });
      }
    }
    if (removed.length) await db.transaction.deleteMany({ where: { userId, dedupeHash: { in: removed.map((id) => `plaid:${id}`) } } });

    await db.plaidItem.update({ where: { id: item.id }, data: { cursor, status: "ok", errorCode: null, lastSyncedAt: new Date() } });
    if (added.length || removed.length) await refreshRecurring(userId, timezone);
    return { accounts: accounts.length, added: inserted, modified: modified.length, removed: removed.length };
  } catch (e) {
    if (e instanceof PlaidError) {
      const status = e.code === "ITEM_LOGIN_REQUIRED" || e.code === "PENDING_EXPIRATION" ? "login_required" : "error";
      await db.plaidItem.update({ where: { id: item.id }, data: { status, errorCode: e.code } });
      throw new HttpError(502, "bank_sync_failed", status === "login_required" ? `${item.institutionName} needs you to sign in again. Use Reconnect.` : e.displayMessage ?? "The bank connection couldn't be refreshed. Try again later.");
    }
    throw e;
  }
}

export async function createLinkToken(userId: string, itemId?: string) {
  if (itemId) {
    const item = await db.plaidItem.findFirst({ where: { id: itemId, userId } });
    if (!item) throw notFound("Bank connection");
    return plaid.linkTokenCreate(userId, open(item.accessTokenEnc));
  }
  return plaid.linkTokenCreate(userId);
}

export async function connectItem(userId: string, publicToken: string, institution: { id: string | null; name: string }, timezone = "UTC") {
  let exchanged: { access_token: string; item_id: string };
  try {
    exchanged = await plaid.exchange(publicToken);
  } catch (e) {
    if (e instanceof PlaidError) throw new HttpError(400, "bank_link_failed", e.displayMessage ?? "That bank connection couldn't be completed. Try again.");
    throw e;
  }
  const item = await db.plaidItem.upsert({
    where: { itemId: exchanged.item_id },
    create: { userId, itemId: exchanged.item_id, institutionId: institution.id, institutionName: institution.name.slice(0, 80) || "Bank", accessTokenEnc: seal(exchanged.access_token) },
    update: { accessTokenEnc: seal(exchanged.access_token), status: "ok", errorCode: null },
  });
  if (item.userId !== userId) throw new HttpError(409, "conflict", "This bank connection belongs to another account.");
  await audit("bank.connected", { userId, metadata: { institution: institution.name } });
  const result = await syncItem(userId, item.id, timezone).catch((e) => ({ error: e instanceof Error ? e.message : "sync failed" }));
  return { id: item.id, result };
}

export async function listItems(userId: string) {
  const items = await db.plaidItem.findMany({ where: { userId }, include: { accounts: { select: { id: true, name: true, mask: true, type: true } } }, orderBy: { createdAt: "asc" } });
  return items.map((i) => ({
    id: i.id,
    institutionName: i.institutionName,
    status: i.status,
    errorCode: i.errorCode,
    lastSyncedAt: i.lastSyncedAt?.toISOString() ?? null,
    accounts: i.accounts,
  }));
}

export async function removeItem(userId: string, itemId: string) {
  const item = await db.plaidItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw notFound("Bank connection");
  await plaid.remove(open(item.accessTokenEnc)).catch((e) => console.error("[veltrix] plaid item/remove failed", e));
  // Imported transactions are removed with the connection; manual records are untouched.
  const accounts = await db.connectedAccount.findMany({ where: { plaidItemId: item.id }, select: { id: true } });
  await db.transaction.deleteMany({ where: { userId, source: "AGGREGATOR", accountId: { in: accounts.map((a) => a.id) } } });
  await db.plaidItem.delete({ where: { id: item.id } }); // cascades to its accounts
  await audit("bank.removed", { userId, metadata: { institution: item.institutionName } });
}

export async function syncAllItems() {
  const items = await db.plaidItem.findMany({ where: { status: { not: "login_required" } }, include: { user: { include: { profile: true } } } });
  let ok = 0;
  for (const i of items) {
    try {
      await syncItem(i.userId, i.id, i.user.profile?.timezone ?? "UTC");
      ok++;
    } catch {
      /* status recorded on the item */
    }
  }
  return { items: items.length, synced: ok };
}
