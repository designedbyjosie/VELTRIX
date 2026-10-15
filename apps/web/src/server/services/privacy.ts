/**
 * Privacy & Permissions: one place that states, from live data, what VELTRIX holds, where it came
 * from, who else sees any of it, what VELTRIX is allowed to do, what's waiting on the user, and
 * what has happened. Nothing here is a static claim about a connection; counts and statuses are read
 * from the database and provider configuration at request time.
 */
import { db } from "../db";
import { env } from "../env";
import { audit } from "../audit";
import { marketData } from "../providers/market";
import { getConsents } from "./users";
import { heldNotifications } from "./notifications";
import { TOOLS } from "../ai/tools";
import { EVENT_GROUPS, type EventGroup } from "@/lib/audit-labels";

/** What each advisor tool reads. A test checks every tool is listed, so this can't drift silently. */
export const TOOL_DATA: Record<string, string> = {
  get_spending_summary: "Transactions and categories",
  get_budget_status: "Budgets",
  get_goals: "Savings goals",
  get_recurring_payments: "Recurring charges",
  get_net_worth: "Account balances",
  search_transactions: "Transactions and categories",
  get_portfolio: "Investments",
  get_watchlist: "Investments",
  get_instrument: "Public market data",
  compare_instruments: "Public market data",
  evaluate_purchase: "Budgets",
  get_saved_products: "Saved products and prices",
  get_trips: "Trips",
  get_insights: "Opportunities",
  get_saved_articles: "Saved articles",
  get_editable_items: "Accounts, budgets and goals (names and amounts)",
  propose_changes: "Accounts, budgets and goals (names and amounts)",
  get_recurring_savings_plan: "Recurring charges",
  get_memory: "Financial memory",
  get_opportunity_map: "Income, spending, balances, goals, trips, saved products and opportunities",
  get_financial_profile: "Income, spending, balances and plan assumptions",
  run_what_if: "Income, spending, balances and plan assumptions",
  review_purchase: "Income, spending, balances and plan assumptions",
  stress_test: "Income, spending, balances and plan assumptions",
};

export function advisorDataAreas(): string[] {
  return [...new Set(TOOLS.map((t) => TOOL_DATA[t.name] ?? "Other records"))].sort();
}

/** Things VELTRIX cannot do. Each is true of the code today, not a policy promise. */
export const CANNOT_DO = [
  { label: "Move money or make payments", basis: "Bank access uses Plaid's read-only Transactions product. There is no payment or transfer integration." },
  { label: "Contact companies for you", basis: "Savings plans prepare a draft; you send it. There are no provider, email-sending or calling integrations." },
  { label: "Buy things", basis: "The browser extension reads a page only when you open it, and never fills forms or clicks." },
  { label: "Change your data without your approval", basis: "Advisor changes are proposals that do nothing until you press Apply, and they expire after a day." },
  { label: "See your bank password", basis: "You sign in to your bank inside Plaid's window; VELTRIX receives an access token, stored encrypted." },
];

export async function privacyOverview(userId: string) {
  const now = new Date();
  const [consents, pref, plaidItems, accountsBySource, txBySource, imports, lastImport, tokens, analyses, products, articles, conversations, messages, lastMessage, memoryCount, memoryOn, proposals, workflows, held, notifCount] =
    await Promise.all([
      getConsents(userId),
      db.userPreference.findUnique({ where: { userId } }),
      db.plaidItem.findMany({ where: { userId }, include: { _count: { select: { accounts: true } } }, orderBy: { createdAt: "asc" } }),
      db.connectedAccount.groupBy({ by: ["source"], where: { userId, archivedAt: null }, _count: true }),
      db.transaction.groupBy({ by: ["source"], where: { userId }, _count: true, _max: { createdAt: true } }),
      db.importBatch.count({ where: { userId } }),
      db.importBatch.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true, filename: true } }),
      db.apiToken.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } }),
      db.browserAnalysis.count({ where: { userId } }),
      db.savedProduct.count({ where: { userId } }),
      db.savedArticle.count({ where: { userId } }),
      db.aIConversation.count({ where: { userId } }),
      db.aIMessage.count({ where: { userId } }),
      db.aIMessage.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.memoryItem.count({ where: { userId } }),
      db.userPreference.findUnique({ where: { userId }, select: { memoryEnabled: true } }),
      db.advisorAction.findMany({ where: { userId, status: "PROPOSED", expiresAt: { gt: now } }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.opportunityWorkflow.findMany({ where: { userId, stage: { in: ["prepared", "approved", "action_taken"] } }, orderBy: { updatedAt: "desc" } }),
      heldNotifications(userId),
      db.notification.count({ where: { userId } }),
    ]);
  const acc = (s: string) => accountsBySource.find((r) => r.source === s)?._count ?? 0;
  const tx = (s: string) => txBySource.find((r) => r.source === s);
  const aiConfigured = env.ai.provider !== "none" && !!env.ai.apiKey;
  const md = marketData();
  const plaidConfigured = !!(env.plaid.clientId && env.plaid.secret);
  const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

  const sources = [
    ...plaidItems.map((i) => ({
      id: `bank:${i.id}`,
      kind: "bank" as const,
      name: i.institutionName,
      status: i.status === "ok" ? ("ok" as const) : ("attention" as const),
      statusText: i.status === "ok" ? (i.lastSyncedAt ? "Syncing normally" : "Waiting for first sync") : i.status === "login_required" ? "Your bank needs you to sign in again" : `Sync problem${i.errorCode ? ` (${i.errorCode})` : ""}`,
      lastUpdated: iso(i.lastSyncedAt),
      records: [{ label: "Accounts", count: i._count.accounts }],
      usedFor: "Balances, transactions, recurring charges and everything calculated from them.",
      sharedWith: `Plaid (${env.plaid.env}) connects to your bank. VELTRIX reads only; it can't move money.`,
      manage: { label: "Manage bank connections", href: "/app/transactions" },
      deletion: "Removing the connection deletes its accounts and the transactions it imported. Manual records stay.",
    })),
    {
      id: "manual",
      kind: "manual" as const,
      name: "Entered by you",
      status: "ok" as const,
      statusText: "Updated when you change it",
      lastUpdated: iso(tx("MANUAL")?._max.createdAt),
      records: [
        { label: "Accounts", count: acc("MANUAL") },
        { label: "Transactions", count: tx("MANUAL")?._count ?? 0 },
      ],
      usedFor: "Everything bank data is used for, for the accounts you track by hand.",
      sharedWith: "Nobody.",
      manage: { label: "Accounts & transactions", href: "/app/transactions" },
      deletion: "Delete accounts or transactions individually.",
    },
    {
      id: "csv",
      kind: "csv" as const,
      name: "Imported files (CSV)",
      status: "ok" as const,
      statusText: lastImport ? `Last import: ${lastImport.filename}` : "No imports yet",
      lastUpdated: iso(lastImport?.createdAt),
      records: [
        { label: "Imports", count: imports },
        { label: "Transactions", count: tx("CSV")?._count ?? 0 },
      ],
      usedFor: "Same as bank transactions.",
      sharedWith: "Nobody. Files are read on the server and not kept.",
      manage: { label: "Transactions", href: "/app/transactions" },
      deletion: "Delete imported transactions individually.",
    },
    {
      id: "extension",
      kind: "extension" as const,
      name: "Browser extension",
      status: tokens.length ? ("ok" as const) : ("off" as const),
      statusText: tokens.length ? `${tokens.length} connected` : "Not connected",
      lastUpdated: iso(tokens.map((t) => t.lastUsedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0]),
      records: [
        { label: "Pages analyzed", count: analyses },
        { label: "Saved products", count: products },
        { label: "Saved articles", count: articles },
      ],
      usedFor: "Product prices against your budget and history, tickers in articles, travel costs against trips. Only when you open the extension on a page.",
      sharedWith: consents.EXTENSION_PAGE_CONTENT && aiConfigured ? "Article text you analyze may go to the AI provider for a summary." : "Nobody.",
      manage: { label: "Extension settings", href: "/app/settings#extension" },
      deletion: "You can delete the history of analyzed pages. Saved products and articles are managed on their pages.",
      deletable: analyses > 0 ? ("extension_history" as const) : undefined,
    },
    {
      id: "advisor",
      kind: "advisor" as const,
      name: "AI advisor conversations",
      status: "ok" as const,
      statusText: aiConfigured ? (consents.AI_PROCESSING ? `Answers use ${env.ai.provider}` : "Built-in analysis only (AI processing is off)") : "Built-in analysis only (no AI provider configured)",
      lastUpdated: iso(lastMessage?.createdAt),
      records: [
        { label: "Conversations", count: conversations },
        { label: "Messages", count: messages },
      ],
      usedFor: "Answering your questions. Old messages give context within the same conversation.",
      sharedWith: aiConfigured && consents.AI_PROCESSING ? `${env.ai.provider}: your question and only the records needed to answer it.` : "Nobody.",
      manage: { label: "Advisor", href: "/app/advisor" },
      deletion: "Delete conversations one at a time, or all of them here.",
      deletable: conversations > 0 ? ("advisor_conversations" as const) : undefined,
    },
    {
      id: "memory",
      kind: "memory" as const,
      name: "Financial memory",
      status: memoryOn?.memoryEnabled === false ? ("off" as const) : ("ok" as const),
      statusText: memoryOn?.memoryEnabled === false ? "Switched off: nothing is used" : "On",
      lastUpdated: null,
      records: [{ label: "Saved items", count: memoryCount }],
      usedFor: "Plans, purchase reviews, stress tests, opportunities and advisor answers.",
      sharedWith: aiConfigured && consents.AI_PROCESSING ? "Enabled items are part of the advisor's context." : "Nobody.",
      manage: { label: "Financial memory", href: "/app/memory" },
      deletion: "Delete items individually, or forget everything.",
    },
    {
      id: "notifications",
      kind: "notifications" as const,
      name: "Notifications",
      status: "ok" as const,
      statusText: `${notifCount} stored`,
      lastUpdated: null,
      records: [{ label: "Notifications", count: notifCount }],
      usedFor: "Telling you about opportunities, price drops, market alerts and savings outcomes.",
      sharedWith: "Nobody.",
      manage: { label: "Notification settings", href: "#notifications" },
      deletion: "Clear all stored notifications.",
      deletable: notifCount > 0 ? ("notifications" as const) : undefined,
    },
  ];

  const thirdParties = [
    { name: "Plaid", configured: plaidConfigured, receives: "Your bank sign-in happens inside Plaid. VELTRIX receives balances and transactions.", active: plaidItems.length > 0 },
    { name: aiConfigured ? `AI provider (${env.ai.provider})` : "AI provider", configured: aiConfigured, receives: "Your question and the records needed to answer it, only while AI processing is on.", active: aiConfigured && consents.AI_PROCESSING },
    { name: md.label, configured: md.id !== "none", receives: "Ticker symbols you look up. No personal or account data.", active: md.id !== "none" },
    { name: "Frankfurter (ECB exchange rates)", configured: env.fx.provider === "frankfurter", receives: "Currency codes only.", active: env.fx.provider === "frankfurter" },
  ];

  const permissions = [
    { id: "AI_PROCESSING", group: "consent", label: "AI processing", enabled: consents.AI_PROCESSING, description: aiConfigured ? `Send your question and the records needed to answer it to ${env.ai.provider}.` : "No AI provider is configured on this server, so this has no effect yet.", dataAreas: advisorDataAreas() },
    { id: "advisorProposals", group: "preference", label: "Advisor may propose changes", enabled: pref?.advisorProposals ?? true, description: "Lets the advisor suggest edits to budgets, goals, accounts, transactions and memory. Each one still waits for you to press Apply." },
    { id: "memoryEnabled", group: "memory", label: "Use financial memory", enabled: pref?.memoryEnabled ?? true, description: "Use the preferences you saved in plans, reviews and advisor answers." },
    { id: "EXTENSION_PAGE_CONTENT", group: "consent", label: "Share article text from the extension", enabled: consents.EXTENSION_PAGE_CONTENT, description: "Send the opening paragraphs of an article you analyze so it can be summarized." },
    { id: "PRICE_TRACKING", group: "consent", label: "Record prices automatically", enabled: consents.PRICE_TRACKING, description: "Record the current price when you analyze a product you've already saved." },
    { id: "extensionAutoAnalyze", group: "preference", label: "Analyze when the extension opens", enabled: pref?.extensionAutoAnalyze ?? true, description: "Opening the extension is the only trigger; pages are never scanned in the background." },
  ];

  const pausedUntil = pref?.notificationsPausedUntil && pref.notificationsPausedUntil > now ? pref.notificationsPausedUntil.toISOString() : null;
  return {
    sources,
    thirdParties,
    permissions,
    cannotDo: CANNOT_DO,
    notifications: {
      frequency: pref?.notifyFrequency ?? "immediate",
      quietHoursStart: pref?.quietHoursStart ?? null,
      quietHoursEnd: pref?.quietHoursEnd ?? null,
      pausedUntil,
      kinds: { notifyBudget: pref?.notifyBudget ?? true, notifyPriceDrops: pref?.notifyPriceDrops ?? true, notifyGoals: pref?.notifyGoals ?? true },
      mutedOpportunityKinds: pref?.mutedInsightKinds ?? [],
      held,
    },
    pending: {
      proposals: proposals.map((a) => ({ id: a.id, summary: a.summary, kind: a.kind, conversationId: a.conversationId, createdAt: a.createdAt.toISOString(), expiresAt: a.expiresAt.toISOString() })),
      workflows: workflows.map((w) => ({
        id: w.id,
        merchant: w.merchant,
        kind: w.kind,
        stage: w.stage,
        // Only "prepared" and "approved" need the user; "action_taken" waits on transaction data.
        waitingOn: w.stage === "action_taken" ? ("data" as const) : ("you" as const),
        updatedAt: w.updatedAt.toISOString(),
      })),
    },
  };
}
export type PrivacyOverview = Awaited<ReturnType<typeof privacyOverview>>;

export async function activityHistory(userId: string, opts: { group?: EventGroup; cursor?: string; limit?: number }) {
  const limit = Math.min(opts.limit ?? 30, 100);
  const prefixes = opts.group ? EVENT_GROUPS[opts.group].prefixes : null;
  const rows = await db.auditEvent.findMany({
    where: { userId, ...(prefixes ? { OR: prefixes.map((p) => ({ type: { startsWith: p } })) } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((e) => ({ id: e.id, type: e.type, createdAt: e.createdAt.toISOString(), userAgent: e.userAgent, detail: describeMeta(e.metadata) })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

/** A short, safe summary of audit metadata (never raw JSON, never secrets). */
function describeMeta(m: unknown): string | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  if (typeof o.summary === "string") return o.summary;
  if (typeof o.institution === "string") return o.institution;
  if (typeof o.permission === "string") return `${o.permission}: ${o.enabled ? "on" : "off"}`;
  if (typeof o.purpose === "string") return `${o.purpose}: ${o.granted ? "on" : "off"}`;
  if (typeof o.source === "string" && typeof o.count === "number") return `${o.source}: ${o.count} removed`;
  if (typeof o.merchant === "string") return o.merchant;
  if (typeof o.frequency === "string") return `Frequency: ${o.frequency}${o.paused ? " (paused)" : ""}`;
  return null;
}

export async function deleteSourceData(userId: string, source: "extension_history" | "advisor_conversations" | "notifications") {
  let count = 0;
  if (source === "extension_history") count = (await db.browserAnalysis.deleteMany({ where: { userId } })).count;
  else if (source === "advisor_conversations") count = (await db.aIConversation.deleteMany({ where: { userId } })).count; // messages and proposals cascade
  else count = (await db.notification.deleteMany({ where: { userId } })).count;
  await audit("data.source_deleted", { userId, metadata: { source, count } });
  return count;
}
