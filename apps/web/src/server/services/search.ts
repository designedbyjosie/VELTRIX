import { formatMoney } from "@veltrix/shared";
import { db } from "../db";
import { cents } from "../money";
import { ymd } from "../dates";
import { marketData } from "../providers/market";

export interface SearchHit {
  type: "transaction" | "instrument" | "goal" | "product" | "article" | "insight" | "trip";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/** Search across the user's records plus market instruments. Every DB query is scoped to userId. */
export async function globalSearch(userId: string, q: string): Promise<{ query: string; hits: SearchHit[] }> {
  const contains = { contains: q, mode: "insensitive" as const };
  const [txns, goals, products, articles, insights, trips, instruments] = await Promise.all([
    db.transaction.findMany({ where: { userId, OR: [{ merchant: contains }, { description: contains }] }, orderBy: { date: "desc" }, take: 5 }),
    db.savingsGoal.findMany({ where: { userId, name: contains, archivedAt: null }, take: 3 }),
    db.savedProduct.findMany({ where: { userId, OR: [{ title: contains }, { merchant: contains }] }, take: 4 }),
    db.savedArticle.findMany({ where: { userId, title: contains }, take: 3 }),
    db.financialInsight.findMany({ where: { userId, status: "ACTIVE", OR: [{ title: contains }, { summary: contains }] }, take: 3 }),
    db.travelPlan.findMany({ where: { userId, OR: [{ name: contains }, { destination: contains }] }, take: 3 }),
    marketData()
      .search(q)
      .catch(() => []),
  ]);
  const hits: SearchHit[] = [
    ...instruments.slice(0, 4).map((i) => ({ type: "instrument" as const, id: i.symbol, title: `${i.symbol} · ${i.name}`, subtitle: i.type, href: `/app/markets/${encodeURIComponent(i.symbol)}` })),
    ...txns.map((t) => ({ type: "transaction" as const, id: t.id, title: t.merchant, subtitle: `${ymd(t.date)} · ${formatMoney(cents(t.amount), t.currency)}`, href: `/app/transactions?q=${encodeURIComponent(t.merchant)}` })),
    ...goals.map((g) => ({ type: "goal" as const, id: g.id, title: g.name, subtitle: `Goal · ${formatMoney(cents(g.targetAmount), g.currency)}`, href: "/app/goals" })),
    ...products.map((p) => ({ type: "product" as const, id: p.id, title: p.title, subtitle: `${p.merchant}${p.latestPrice ? ` · ${formatMoney(cents(p.latestPrice), p.currency)}` : ""}`, href: `/app/shopping?product=${p.id}` })),
    ...articles.map((a) => ({ type: "article" as const, id: a.id, title: a.title, subtitle: a.publisher ?? "Saved article", href: "/app/markets#articles" })),
    ...insights.map((i) => ({ type: "insight" as const, id: i.id, title: i.title, subtitle: "Recommendation", href: "/app/advisor#insights" })),
    ...trips.map((t) => ({ type: "trip" as const, id: t.id, title: t.name, subtitle: t.destination, href: "/app/travel" })),
  ];
  return { query: q, hits };
}
