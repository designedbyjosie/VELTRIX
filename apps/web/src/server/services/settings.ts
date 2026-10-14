import type { z } from "zod";
import type { preferenceUpdateSchema, profileUpdateSchema } from "@veltrix/shared";
import { db } from "../db";
import { notFound } from "../errors";
import { cents } from "../money";
import { ymd } from "../dates";

export async function updateProfile(userId: string, input: z.infer<typeof profileUpdateSchema>) {
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
    } catch {
      input.timezone = "UTC";
    }
  }
  return db.userProfile.update({ where: { userId }, data: { displayName: input.displayName, baseCurrency: input.baseCurrency, timezone: input.timezone } });
}

export async function updatePreferences(userId: string, input: z.infer<typeof preferenceUpdateSchema>) {
  return db.userPreference.upsert({ where: { userId }, create: { userId, ...input }, update: input });
}

export async function listSessions(userId: string, currentSessionId?: string) {
  const rows = await db.session.findMany({ where: { userId, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } });
  return rows.map((s) => ({ id: s.id, userAgent: s.userAgent, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), current: s.id === currentSessionId }));
}

export async function revokeSession(userId: string, id: string) {
  const s = await db.session.findFirst({ where: { id, userId } });
  if (!s) throw notFound("Session");
  await db.session.delete({ where: { id } });
}

export async function listApiTokens(userId: string) {
  const rows = await db.apiToken.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  return rows.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, scopes: t.scopes, createdAt: t.createdAt.toISOString(), lastUsedAt: t.lastUsedAt?.toISOString() ?? null, expiresAt: t.expiresAt.toISOString() }));
}

export async function revokeApiToken(userId: string, id: string) {
  const t = await db.apiToken.findFirst({ where: { id, userId } });
  if (!t) throw notFound("Connection");
  await db.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
}

export async function listAuditEvents(userId: string) {
  const rows = await db.auditEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 });
  return rows.map((e) => ({ id: e.id, type: e.type, userAgent: e.userAgent, createdAt: e.createdAt.toISOString() }));
}

/** Everything VELTRIX stores about the user, minus secrets (password hash, token hashes). */
export async function exportUserData(userId: string) {
  const [user, accounts, balances, transactions, budgets, goals, recurring, holdings, snapshots, watchlists, alerts, insights, conversations, products, deals, articles, analyses, trips, rewards, consents, notifications, memory, plans] =
    await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, createdAt: true, profile: true, preference: true } }),
      db.connectedAccount.findMany({ where: { userId } }),
      db.accountBalance.findMany({ where: { userId } }),
      db.transaction.findMany({ where: { userId }, include: { category: { select: { name: true } } } }),
      db.budget.findMany({ where: { userId }, include: { lines: true } }),
      db.savingsGoal.findMany({ where: { userId }, include: { contributions: true } }),
      db.recurringPayment.findMany({ where: { userId } }),
      db.investmentHolding.findMany({ where: { userId }, include: { instrument: { select: { symbol: true, name: true } } } }),
      db.portfolioSnapshot.findMany({ where: { userId } }),
      db.watchlist.findMany({ where: { userId }, include: { items: { include: { instrument: { select: { symbol: true } } } } } }),
      db.marketAlert.findMany({ where: { userId } }),
      db.financialInsight.findMany({ where: { userId } }),
      db.aIConversation.findMany({ where: { userId }, include: { messages: { select: { role: true, content: true, createdAt: true } } } }),
      db.savedProduct.findMany({ where: { userId }, include: { observations: true } }),
      db.deal.findMany({ where: { userId } }),
      db.savedArticle.findMany({ where: { userId } }),
      db.browserAnalysis.findMany({ where: { userId } }),
      db.travelPlan.findMany({ where: { userId }, include: { expenses: true } }),
      db.rewardProgram.findMany({ where: { userId } }),
      db.consentRecord.findMany({ where: { userId } }),
      db.notification.findMany({ where: { userId } }),
      db.memoryItem.findMany({ where: { userId } }),
      db.planSnapshot.findMany({ where: { userId } }),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    format: "veltrix-export-v1",
    user,
    accounts,
    balances,
    transactions,
    budgets,
    goals,
    recurring,
    holdings,
    snapshots,
    watchlists,
    alerts,
    insights,
    conversations,
    products,
    deals,
    articles,
    browserAnalyses: analyses,
    trips,
    rewards,
    consents,
    notifications,
    memory,
    savedPlans: plans,
  };
}

function csvCell(v: string): string {
  // Neutralize spreadsheet formula injection and quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function exportTransactionsCsv(userId: string) {
  const rows = await db.transaction.findMany({ where: { userId }, include: { category: true, account: true }, orderBy: { date: "desc" } });
  const header = ["Date", "Merchant", "Description", "Amount", "Currency", "Category", "Account", "Source", "Notes"];
  const lines = rows.map((t) =>
    [ymd(t.date), t.merchant, t.description, (cents(t.amount) / 100).toFixed(2), t.currency, t.category?.name ?? "", t.account?.name ?? "", t.source, t.notes].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

export async function deleteUserAccount(userId: string) {
  // All user-owned rows cascade from User; audit events are detached (userId set null) by the FK.
  await db.user.delete({ where: { id: userId } });
}
