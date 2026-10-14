/**
 * Backend for the VELTRIX browser extension. The extension sends a minimal,
 * schema-validated summary of the current page; nothing here fetches the page
 * or trusts page text as instructions.
 */
import { formatMoney, fromCents, type ExtensionAnalysis, type InsightLine, type PageExtractionInput } from "@veltrix/shared";
import { db } from "../db";
import { cents } from "../money";
import { badRequest, HttpError } from "../errors";
import { normalizePairingCode, pairingCode, sha256 } from "../auth/crypto";
import { createApiToken } from "../auth/session";
import { todayIn } from "../dates";
import { marketData } from "../providers/market";
import { summarizeArticle } from "../ai/advisor";
import { budgetStatusForMonth } from "./budgets";
import { listGoals } from "./goals";
import { alternativesFor, priceVerdict, historyStats, recordObservation, saveProduct } from "./shopping";
import { saveArticle } from "./articles";
import { addToWatchlist, watchedSymbols } from "./investments";
import { addTravelExpense, listTrips } from "./travel";
import { hasConsent, userContext } from "./users";
import { decidePurchase } from "./plan";

export const EXTENSION_SCOPE = "extension";
const PAIRING_TTL_MS = 10 * 60 * 1000;

export async function createPairingCode(userId: string) {
  // Only one live code per user.
  await db.pairingCode.deleteMany({ where: { userId, usedAt: null } });
  const code = pairingCode();
  await db.pairingCode.create({ data: { userId, codeHash: sha256(normalizePairingCode(code)), expiresAt: new Date(Date.now() + PAIRING_TTL_MS) } });
  return { code, expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString() };
}

export async function redeemPairingCode(code: string, deviceName: string) {
  const record = await db.pairingCode.findUnique({ where: { codeHash: sha256(normalizePairingCode(code)) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw new HttpError(400, "invalid_code", "That code is invalid or has expired. Generate a new one in VELTRIX settings.");
  // Mark used atomically so a code can only ever be redeemed once.
  const claimed = await db.pairingCode.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) throw new HttpError(400, "invalid_code", "That code has already been used.");
  const { token, record: tokenRecord } = await createApiToken(record.userId, deviceName, [EXTENSION_SCOPE]);
  return { token, userId: record.userId, tokenId: tokenRecord.id, expiresAt: tokenRecord.expiresAt.toISOString() };
}

export async function extensionMe(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true, preference: true } });
  return {
    displayName: user.profile?.displayName ?? user.email.split("@")[0],
    email: user.email,
    baseCurrency: user.profile?.baseCurrency ?? "USD",
    consents: {
      pageContent: await hasConsent(userId, "EXTENSION_PAGE_CONTENT"),
      aiProcessing: await hasConsent(userId, "AI_PROCESSING"),
      priceTracking: await hasConsent(userId, "PRICE_TRACKING"),
    },
    autoAnalyze: user.preference?.extensionAutoAnalyze ?? true,
  };
}

const DISCLAIMER = "Information and research only — not financial advice.";

export async function analyzePage(userId: string, page: PageExtractionInput, timezone = "UTC"): Promise<ExtensionAnalysis> {
  const insights: InsightLine[] = [];
  const disclaimers = [DISCLAIMER];
  const generatedAt = new Date().toISOString();
  // Page excerpts are only accepted with explicit consent.
  if (page.article?.excerpt && !(await hasConsent(userId, "EXTENSION_PAGE_CONTENT"))) page.article.excerpt = null;

  await db.browserAnalysis.create({
    data: { userId, domain: page.domain.slice(0, 253), pageType: page.pageType, entities: { symbols: page.symbols.slice(0, 12), hasProduct: !!page.product } },
  });

  if (page.pageType === "unsupported") {
    return {
      pageType: "unsupported",
      headline: page.unsupportedReason === "sensitive" ? "VELTRIX doesn't analyze checkout, login or banking pages" : "No product, financial article or ticker detected on this page",
      insights: [],
      disclaimers,
      generatedAt,
    };
  }

  if (page.pageType === "product" && page.product) {
    const p = page.product;
    const saved = await db.savedProduct.findFirst({ where: { userId, canonicalUrl: page.canonicalUrl }, include: { observations: { orderBy: { observedAt: "asc" } } } });
    // With price-tracking consent, re-visiting a saved product records the observed price.
    if (saved && p.priceCents && p.currency && (await hasConsent(userId, "PRICE_TRACKING"))) {
      await recordObservation(userId, saved.id, { priceCents: p.priceCents, currency: p.currency, merchant: p.merchant, sourceUrl: page.url, availability: p.availability, source: "EXTENSION" });
    }
    const obs = saved
      ? (await db.priceObservation.findMany({ where: { savedProductId: saved.id }, orderBy: { observedAt: "asc" } })).map((o) => ({
          observedAt: o.observedAt.toISOString(),
          priceCents: cents(o.price),
          merchant: o.merchant,
          source: o.source,
        }))
      : [];
    const verdict = p.priceCents && obs.length ? priceVerdict(p.priceCents, obs) : null;
    const alternatives = (await alternativesFor(userId, { gtin: p.gtin, sku: p.sku, brand: p.brand, canonicalUrl: page.canonicalUrl })).filter((a) => a.currency === p.currency);
    const month = todayIn(timezone).slice(0, 7);
    const budgets = await budgetStatusForMonth(userId, month, timezone);
    const shoppingLine = budgets.flatMap((b) => b.lines.map((l) => ({ ...l, currency: b.currency }))).find((l) => l.category.slug === "shopping");

    if (saved) insights.push({ text: `On your ${saved.status === "WATCHING" ? "watch list" : "wishlist"} since ${saved.createdAt.toISOString().slice(0, 10)}.`, provenance: "user" });
    else insights.push({ text: "Save this product to start recording its price history.", provenance: "education" });
    if (verdict) insights.push({ text: `${verdict.label}. ${verdict.basis}`, provenance: "observed", tone: verdict.tone === "warning" ? "warning" : verdict.tone });
    else if (saved && obs.length < 3) insights.push({ text: `${obs.length} price${obs.length === 1 ? "" : "s"} recorded so far — at least 3 are needed for a price verdict.`, provenance: "observed" });
    const cheaper = alternatives.filter((a) => p.priceCents && a.priceCents < p.priceCents);
    if (cheaper.length) {
      const best = cheaper.sort((a, b) => a.priceCents - b.priceCents)[0];
      insights.push({ text: `You recorded this item for ${formatMoney(best.priceCents, best.currency)} at ${best.merchant} on ${best.observedAt.slice(0, 10)} (${formatMoney((p.priceCents ?? 0) - best.priceCents, best.currency)} less). Check it's still available.`, provenance: "observed", tone: "positive" });
    }
    if (p.priceCents && shoppingLine && p.currency === shoppingLine.currency) {
      const after = shoppingLine.remainingCents - p.priceCents;
      insights.push({
        text: after >= 0 ? `Fits your Shopping budget: ${formatMoney(after, p.currency)} would remain this month.` : `Would exceed your Shopping budget by ${formatMoney(-after, p.currency)} this month.`,
        provenance: "estimate",
        tone: after >= 0 ? "positive" : "warning",
      });
    }
    const goals = await listGoals(userId, timezone);
    const goal = goals.find((g) => g.projection.remainingCents > 0 && g.currency === p.currency);
    if (goal && p.priceCents) {
      insights.push({ text: `Equal to ${((p.priceCents / goal.projection.remainingCents) * 100).toFixed(1)}% of what's left to save for "${goal.name}".`, provenance: "estimate" });
    }
    disclaimers.push("Coupons and cashback are only shown when verified; VELTRIX doesn't have a merchant price feed configured.");
    const stats = historyStats(obs);

    // Decision review against the user's own plan (same engine as the What-if Lab).
    let decision: NonNullable<ExtensionAnalysis["product"]>["decision"] = null;
    const ctx = await userContext(userId);
    if (p.priceCents && p.currency === ctx.currency) {
      try {
        const best = cheaper[0];
        const d = await decidePurchase(
          userId,
          {
            label: p.title.slice(0, 80) || "This product",
            priceCents: p.priceCents,
            categorySlug: "shopping",
            alternative: best ? { label: `Same item at ${best.merchant}`.slice(0, 80), priceCents: best.priceCents, verified: true } : null,
            horizonMonths: 24,
          },
          ctx,
        );
        decision = {
          verdict: d.verdict,
          title: { fits: "Fits your plan", consider: "Consider alternatives", risk: "Could put a goal at risk", unknown: "Not enough data to review" }[d.verdict],
          reasons: d.reasons.slice(0, 3).map((r) => r.text),
          limited: d.confidence === "limited",
          reviewPath: `/app/plan?tab=decide&item=${encodeURIComponent(p.title.slice(0, 50))}&price=${(p.priceCents / 100).toFixed(2)}`,
        };
      } catch (err) {
        console.error("[extension] decision review failed", err);
      }
    }
    return {
      pageType: "product",
      headline: p.title,
      product: {
        title: p.title,
        merchant: p.merchant,
        priceCents: p.priceCents,
        currency: p.currency,
        imageUrl: p.imageUrl,
        saved: saved ? { id: saved.id, status: saved.status } : null,
        history: obs.slice(-30),
        historyStats: stats,
        verdict: verdict ? { label: verdict.label, tone: verdict.tone, basis: verdict.basis } : null,
        budget: shoppingLine ? { categoryName: shoppingLine.category.name, remainingCents: shoppingLine.remainingCents, limitCents: shoppingLine.limitCents, currency: shoppingLine.currency } : null,
        alternatives,
        decision,
      },
      insights,
      disclaimers,
      generatedAt,
    };
  }

  if (page.pageType === "travel" && page.travel) {
    const t = page.travel;
    const trips = (await listTrips(userId)).filter((x) => x.status === "PLANNING" || x.status === "BOOKED");
    for (const trip of trips.slice(0, 3)) {
      if (t.priceCents && trip.budgetCents !== null && t.currency === trip.currency) {
        const left = trip.budgetCents - trip.projectedCents;
        insights.push({
          text: `${trip.name}: ${formatMoney(Math.max(0, left), trip.currency)} unallocated in the budget; this price would ${t.priceCents <= left ? "fit" : `exceed it by ${formatMoney(t.priceCents - left, trip.currency)}`}.`,
          provenance: "estimate",
          tone: t.priceCents <= left ? "positive" : "warning",
        });
      }
    }
    if (!trips.length) insights.push({ text: "Create a trip in VELTRIX to compare prices like this against a budget.", provenance: "education" });
    if (!t.priceCents) insights.push({ text: "No price was found in this page's structured data.", provenance: "observed" });
    disclaimers.push("Prices are what this page displayed when analyzed; VELTRIX can't book travel or verify fares.");
    return {
      pageType: "travel",
      headline: t.title || `${t.kind} on ${t.provider}`,
      travel: { kind: t.kind, provider: t.provider, priceCents: t.priceCents, currency: t.currency, trips: trips.map((x) => ({ id: x.id, name: x.name, budgetCents: x.budgetCents, spentCents: x.projectedCents, currency: x.currency })) },
      insights,
      disclaimers,
      generatedAt,
    };
  }

  // Articles and instrument pages
  const md = marketData();
  const watched = await watchedSymbols(userId);
  const instruments = await Promise.all(
    page.symbols.slice(0, 6).map(async (s) => {
      const [profile, quote] = await Promise.all([md.profile(s).catch(() => null), md.quote(s).catch(() => null)]);
      return {
        symbol: s,
        name: profile?.name ?? null,
        known: !!profile || !!quote,
        priceCents: quote ? Math.round(quote.price * 100) : null,
        currency: quote?.currency ?? null,
        changePercent: quote?.changePercent ?? null,
        asOf: quote?.asOf ?? null,
        dataSource: quote ? md.label : null,
        isDemo: quote?.isDemo ?? false,
        onWatchlist: watched.has(s),
      };
    }),
  );
  if (md.isDemo && instruments.some((i) => i.known)) disclaimers.push("Market prices shown are simulated demo data, not real quotes.");
  for (const i of instruments.filter((x) => x.onWatchlist)) insights.push({ text: `${i.symbol} is on your watchlist.`, provenance: "user" });
  const unknown = instruments.filter((x) => !x.known).map((x) => x.symbol);
  if (unknown.length) insights.push({ text: `No market data available for ${unknown.join(", ")} from the configured source.`, provenance: "provider" });

  let article: ExtensionAnalysis["article"];
  if (page.pageType === "article" && page.article) {
    const a = page.article;
    const savedArticle = await db.savedArticle.findFirst({ where: { userId, canonicalUrl: page.canonicalUrl } });
    const aiSummary = await summarizeArticle(userId, a);
    article = {
      headline: a.headline,
      publisher: a.publisher,
      publishedAt: a.publishedAt,
      summary: aiSummary ?? a.description,
      summarySource: aiSummary ? "ai" : a.description ? "page-metadata" : "none",
      saved: !!savedArticle,
    };
    if (aiSummary) disclaimers.push("AI summary generated from the page text; check the article for details.");
    else insights.push({ text: a.excerpt ? "AI summaries aren't available — the AI provider isn't configured or AI processing isn't enabled." : "Showing the publisher's description. Enable page-content sharing in extension settings for AI summaries.", provenance: "education" });
  }
  return {
    pageType: page.pageType,
    headline: article?.headline ?? (instruments.length ? instruments.map((i) => i.symbol).join(", ") : page.title),
    instruments,
    article,
    insights,
    disclaimers,
    generatedAt,
  };
}

export async function saveFromExtension(
  userId: string,
  input:
    | { kind: "product"; extraction: PageExtractionInput; status: "WISHLIST" | "WATCHING" }
    | { kind: "article"; extraction: PageExtractionInput }
    | { kind: "watchlist"; symbol: string }
    | { kind: "travel"; extraction: PageExtractionInput; tripId: string },
) {
  if (input.kind === "watchlist") {
    await addToWatchlist(userId, input.symbol, "", "EXTENSION");
    return { saved: "watchlist", symbol: input.symbol };
  }
  const page = input.extraction;
  if (input.kind === "product") {
    const p = page.product;
    if (!p) throw badRequest("No product was detected on this page.");
    const product = await saveProduct(
      userId,
      {
        title: p.title,
        merchant: p.merchant,
        url: page.url,
        imageUrl: p.imageUrl && p.imageUrl.startsWith("https:") ? p.imageUrl : null,
        price: p.priceCents ? fromCents(p.priceCents) : null,
        currency: p.currency ?? "USD",
        status: input.status,
        brand: p.brand,
        sku: p.sku,
        gtin: p.gtin,
        availability: p.availability,
        notes: "",
        source: "EXTENSION",
      },
      "EXTENSION",
    );
    return { saved: "product", id: product.id, status: product.status };
  }
  if (input.kind === "article") {
    const a = page.article;
    const title = a?.headline ?? page.title;
    if (!title) throw badRequest("No article was detected on this page.");
    const article = await saveArticle(userId, {
      title,
      url: page.url,
      publisher: a?.publisher ?? null,
      publishedAt: a?.publishedAt ?? null,
      summary: a?.description ?? null,
      summarySource: a?.description ? "page-metadata" : "none",
      symbols: page.symbols,
      source: "EXTENSION",
    });
    return { saved: "article", id: article.id };
  }
  const t = page.travel;
  if (!t || !t.priceCents || !t.currency) throw badRequest("No travel price was detected on this page.");
  const category = t.kind === "flight" ? "FLIGHT" : t.kind === "hotel" ? "LODGING" : t.kind === "car" ? "CAR" : "OTHER";
  const e = await addTravelExpense(
    userId,
    input.tripId,
    { category, description: t.title.slice(0, 200) || `${t.kind} quote`, amount: fromCents(t.priceCents), currency: t.currency, date: t.startDate, provider: t.provider, isQuote: true, sourceUrl: page.url },
    "EXTENSION",
  );
  return { saved: "travel", id: e.id };
}
