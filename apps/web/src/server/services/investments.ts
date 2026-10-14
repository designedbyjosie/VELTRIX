import type { z } from "zod";
import { portfolioPerformance, summarizePortfolio, type alertCreateSchema, type holdingCreateSchema } from "@veltrix/shared";
import { db } from "../db";
import { cents, decStr } from "../money";
import { badRequest, notFound } from "../errors";
import { fromYmd, ymd, todayIn, addDays } from "../dates";
import { marketData, RANGE_DAYS, type HistoryRange, type Quote } from "../providers/market";
import { notify } from "./notifications";

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-^]{0,9}$/;

/** Find or create the reference instrument for a ticker. Unknown tickers are stored as unverified. */
export async function ensureInstrument(symbolRaw: string) {
  const symbol = symbolRaw.toUpperCase();
  if (!SYMBOL_RE.test(symbol)) throw badRequest("That doesn't look like a ticker symbol.");
  const existing = await db.financialInstrument.findFirst({ where: { symbol }, orderBy: { updatedAt: "desc" } });
  if (existing && existing.dataSource !== "unverified") return existing;
  const md = marketData();
  const profile = await md.profile(symbol).catch(() => null);
  if (existing) {
    if (!profile) return existing;
    return db.financialInstrument.update({
      where: { id: existing.id },
      data: { name: profile.name, type: profile.type, sector: profile.sector, description: profile.description, currency: profile.currency, dataSource: md.id, isDemo: md.isDemo },
    });
  }
  return db.financialInstrument.create({
    data: profile
      ? { symbol, name: profile.name, type: profile.type, exchange: profile.exchange, currency: profile.currency, sector: profile.sector, description: profile.description, dataSource: md.id, isDemo: md.isDemo }
      : { symbol, name: symbol, type: "OTHER", exchange: "", currency: "USD", dataSource: "unverified", isDemo: false },
  });
}

export async function quotesFor(symbols: string[]): Promise<Map<string, Quote>> {
  const md = marketData();
  const unique = [...new Set(symbols)];
  const results = await Promise.all(unique.map((s) => md.quote(s).catch(() => null)));
  const map = new Map<string, Quote>();
  unique.forEach((s, i) => {
    const q = results[i];
    if (q) map.set(s, q);
  });
  return map;
}

export async function getPortfolio(userId: string) {
  const holdings = await db.investmentHolding.findMany({ where: { userId, account: { archivedAt: null } }, include: { instrument: true, account: true } });
  const quotes = await quotesFor(holdings.map((h) => h.instrument.symbol));
  const md = marketData();
  const rows = holdings.map((h) => {
    const q = quotes.get(h.instrument.symbol) ?? null;
    const qty = Number(h.quantity.toString());
    const mv = q ? Math.round(qty * q.price * 100) : null;
    return {
      id: h.id,
      accountId: h.accountId,
      accountName: h.account.name,
      symbol: h.instrument.symbol,
      name: h.instrument.name,
      type: h.instrument.type,
      sector: h.instrument.sector,
      quantity: h.quantity.toString(),
      costBasisCents: cents(h.costBasis),
      price: q?.price ?? null,
      priceAsOf: q?.asOf ?? null,
      changePercent: q?.changePercent ?? null,
      marketValueCents: mv,
      unrealizedGainCents: mv === null ? null : mv - cents(h.costBasis),
      source: h.source,
      priceIsDemo: q?.isDemo ?? false,
    };
  });
  const valued = rows.filter((r) => r.marketValueCents !== null);
  const summary = summarizePortfolio(
    valued.map((r) => ({ symbol: r.symbol, type: r.type, sector: r.sector, marketValueCents: r.marketValueCents!, costBasisCents: r.costBasisCents })),
    "type",
  );
  const bySector = summarizePortfolio(
    valued.map((r) => ({ symbol: r.symbol, type: r.type, sector: r.sector, marketValueCents: r.marketValueCents!, costBasisCents: r.costBasisCents })),
    "sector",
  ).allocation;
  return {
    holdings: rows.sort((a, b) => (b.marketValueCents ?? 0) - (a.marketValueCents ?? 0)),
    summary,
    bySector,
    unpricedCount: rows.length - valued.length,
    dataSource: { id: md.id, label: md.label, isDemo: md.isDemo },
  };
}

export async function addHolding(userId: string, input: z.infer<typeof holdingCreateSchema>) {
  const account = await db.connectedAccount.findFirst({ where: { id: input.accountId, userId } });
  if (!account) throw notFound("Account");
  if (account.type !== "INVESTMENT" && account.type !== "RETIREMENT") throw badRequest("Holdings can only be added to investment or retirement accounts.");
  const instrument = await ensureInstrument(input.symbol);
  return db.investmentHolding.upsert({
    where: { accountId_instrumentId: { accountId: account.id, instrumentId: instrument.id } },
    create: { userId, accountId: account.id, instrumentId: instrument.id, quantity: decStr(input.quantity), costBasis: decStr(input.costBasis) },
    update: { quantity: decStr(input.quantity), costBasis: decStr(input.costBasis) },
  });
}

export async function deleteHolding(userId: string, id: string) {
  const h = await db.investmentHolding.findFirst({ where: { id, userId } });
  if (!h) throw notFound("Holding");
  await db.investmentHolding.delete({ where: { id } });
}

export async function performance(userId: string, range: HistoryRange, timezone = "UTC") {
  const since = addDays(todayIn(timezone), -RANGE_DAYS[range]);
  const snaps = await db.portfolioSnapshot.findMany({ where: { userId, date: { gte: fromYmd(since) } }, orderBy: { date: "asc" } });
  const points = snaps.map((s) => ({
    date: ymd(s.date),
    marketValueCents: cents(s.marketValue),
    netContributionsCents: cents(s.netContributions),
    isDemo: s.source === "DEMO",
  }));
  return { points, result: portfolioPerformance(points), isDemo: points.some((p) => p.isDemo) };
}

// ---------------------------------------------------------------- watchlists

export async function defaultWatchlist(userId: string) {
  const w = await db.watchlist.findFirst({ where: { userId, isDefault: true } });
  return w ?? db.watchlist.create({ data: { userId, name: "My watchlist", isDefault: true } });
}

export async function getWatchlist(userId: string) {
  const w = await defaultWatchlist(userId);
  const items = await db.watchlistItem.findMany({ where: { watchlistId: w.id }, include: { instrument: true }, orderBy: { addedAt: "desc" } });
  const quotes = await quotesFor(items.map((i) => i.instrument.symbol));
  return {
    id: w.id,
    name: w.name,
    items: items.map((i) => {
      const q = quotes.get(i.instrument.symbol) ?? null;
      return {
        id: i.id,
        symbol: i.instrument.symbol,
        name: i.instrument.name,
        type: i.instrument.type,
        verified: i.instrument.dataSource !== "unverified",
        note: i.note,
        source: i.source,
        addedAt: i.addedAt.toISOString(),
        quote: q,
      };
    }),
  };
}

export async function addToWatchlist(userId: string, symbol: string, note = "", source: "WEB" | "EXTENSION" = "WEB") {
  const w = await defaultWatchlist(userId);
  const instrument = await ensureInstrument(symbol);
  return db.watchlistItem.upsert({
    where: { watchlistId_instrumentId: { watchlistId: w.id, instrumentId: instrument.id } },
    create: { watchlistId: w.id, instrumentId: instrument.id, note, source: source === "EXTENSION" ? "EXTENSION" : "MANUAL" },
    update: note ? { note } : {},
  });
}

export async function removeFromWatchlist(userId: string, itemId: string) {
  const item = await db.watchlistItem.findFirst({ where: { id: itemId, watchlist: { userId } } });
  if (!item) throw notFound("Watchlist item");
  await db.watchlistItem.delete({ where: { id: itemId } });
}

export async function watchedSymbols(userId: string): Promise<Set<string>> {
  const items = await db.watchlistItem.findMany({ where: { watchlist: { userId } }, include: { instrument: { select: { symbol: true } } } });
  return new Set(items.map((i) => i.instrument.symbol));
}

// ---------------------------------------------------------------- alerts

export async function listAlerts(userId: string) {
  const rows = await db.marketAlert.findMany({ where: { userId }, include: { instrument: true }, orderBy: { createdAt: "desc" } });
  return rows.map((a) => ({
    id: a.id,
    symbol: a.instrument.symbol,
    condition: a.condition,
    targetPrice: Number(a.targetPrice.toString()),
    status: a.status,
    triggeredAt: a.triggeredAt?.toISOString() ?? null,
    lastCheckedAt: a.lastCheckedAt?.toISOString() ?? null,
  }));
}

export async function createAlert(userId: string, input: z.infer<typeof alertCreateSchema>) {
  const instrument = await ensureInstrument(input.symbol);
  const count = await db.marketAlert.count({ where: { userId, status: "ACTIVE" } });
  if (count >= 50) throw badRequest("You can have up to 50 active alerts.");
  return db.marketAlert.create({ data: { userId, instrumentId: instrument.id, condition: input.condition, targetPrice: decStr(input.targetPrice) } });
}

export async function deleteAlert(userId: string, id: string) {
  const a = await db.marketAlert.findFirst({ where: { id, userId } });
  if (!a) throw notFound("Alert");
  await db.marketAlert.delete({ where: { id } });
}

/** Evaluate active alerts against current quotes. Called on page load and by the scheduled job. */
export async function checkAlerts(userId: string) {
  const alerts = await db.marketAlert.findMany({ where: { userId, status: "ACTIVE" }, include: { instrument: true } });
  if (!alerts.length) return 0;
  const quotes = await quotesFor(alerts.map((a) => a.instrument.symbol));
  let triggered = 0;
  for (const a of alerts) {
    const q = quotes.get(a.instrument.symbol);
    if (!q) continue;
    const target = Number(a.targetPrice.toString());
    const hit = a.condition === "ABOVE" ? q.price >= target : q.price <= target;
    await db.marketAlert.update({ where: { id: a.id }, data: { lastCheckedAt: new Date(), ...(hit ? { status: "TRIGGERED", triggeredAt: new Date() } : {}) } });
    if (hit) {
      triggered++;
      await notify(userId, {
        kind: "price_alert",
        dedupeKey: `alert:${a.id}`,
        title: `${a.instrument.symbol} is ${a.condition === "ABOVE" ? "above" : "below"} ${target.toFixed(2)}`,
        body: `Last price ${q.price.toFixed(2)} ${q.currency}${q.isDemo ? " (demo data)" : ""} as of ${new Date(q.asOf).toUTCString()}.`,
        link: `/app/markets/${a.instrument.symbol}`,
      });
    }
  }
  return triggered;
}
