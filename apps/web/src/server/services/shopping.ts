import type { z } from "zod";
import { canonicalizeUrl, formatMoney, toCents, type dealCreateSchema, type productSaveSchema, type productUpdateSchema, type rewardProgramSchema } from "@veltrix/shared";
import { db } from "../db";
import { cents, centsOrNull, dec, decStr } from "../money";
import { badRequest, notFound } from "../errors";
import { fromYmd, ymd } from "../dates";
import { notify } from "./notifications";

type Origin = "EXTENSION" | "MANUAL" | "DEMO";

export async function recordObservation(
  userId: string,
  productId: string,
  o: { priceCents: number; currency: string; merchant: string; sourceUrl: string; availability?: string | null; shippingCents?: number | null; source: Origin; observedAt?: Date },
) {
  const at = o.observedAt ?? new Date();
  const key = `${productId}:${at.toISOString().slice(0, 10)}:${o.priceCents}:${o.currency}`;
  const before = await db.savedProduct.findFirst({ where: { id: productId, userId } });
  if (!before) throw notFound("Product");
  const obs = await db.priceObservation.upsert({
    where: { userId_observationKey: { userId, observationKey: key } },
    create: {
      userId,
      savedProductId: productId,
      price: dec(o.priceCents),
      currency: o.currency,
      merchant: o.merchant,
      sourceUrl: o.sourceUrl,
      availability: o.availability ?? null,
      shippingCost: o.shippingCents != null ? dec(o.shippingCents) : null,
      source: o.source,
      observedAt: at,
      observationKey: key,
    },
    update: {},
  });
  if (!before.latestSeenAt || before.latestSeenAt <= at) {
    await db.savedProduct.update({ where: { id: productId }, data: { latestPrice: dec(o.priceCents), latestSeenAt: at, currency: o.currency } });
  }
  // A drop we observed ourselves (both prices recorded by VELTRIX) is a verified deal.
  const prev = before.latestPrice ? cents(before.latestPrice) : null;
  if (prev !== null && o.priceCents < prev && before.currency === o.currency && o.source !== "DEMO") {
    await db.deal.create({
      data: {
        userId,
        savedProductId: productId,
        title: before.title,
        merchant: o.merchant,
        url: o.sourceUrl,
        currency: o.currency,
        price: dec(o.priceCents),
        previousPrice: dec(prev),
        verification: "VERIFIED",
        confidence: "HIGH",
        source: o.source === "EXTENSION" ? "EXTENSION" : "MANUAL",
      },
    });
    const target = centsOrNull(before.targetPrice);
    await notify(userId, {
      kind: "price_drop",
      dedupeKey: `drop:${productId}:${key}`,
      title: `Price drop: ${before.title.slice(0, 60)}`,
      body: `Now ${formatMoney(o.priceCents, o.currency)} at ${o.merchant} (was ${formatMoney(prev, o.currency)} when you last saw it)${target !== null && o.priceCents <= target ? " — at or below your target price" : ""}.`,
      link: `/app/shopping?product=${productId}`,
    });
  }
  return obs;
}

export async function saveProduct(userId: string, input: z.infer<typeof productSaveSchema>, source: Origin = input.source) {
  const canonicalUrl = canonicalizeUrl(input.url);
  if (!canonicalUrl) throw badRequest("Only http(s) product links can be saved.");
  const product = await db.savedProduct.upsert({
    where: { userId_canonicalUrl: { userId, canonicalUrl } },
    create: {
      userId,
      title: input.title,
      merchant: input.merchant,
      url: input.url,
      canonicalUrl,
      imageUrl: input.imageUrl ?? null,
      currency: input.currency,
      targetPrice: input.targetPrice ? decStr(input.targetPrice) : null,
      status: input.status,
      brand: input.brand ?? null,
      sku: input.sku ?? null,
      gtin: input.gtin ?? null,
      notes: input.notes,
      source,
    },
    update: {
      title: input.title,
      imageUrl: input.imageUrl ?? undefined,
      status: input.status,
      brand: input.brand ?? undefined,
      sku: input.sku ?? undefined,
      gtin: input.gtin ?? undefined,
      ...(input.targetPrice ? { targetPrice: decStr(input.targetPrice) } : {}),
    },
  });
  if (input.price) {
    await recordObservation(userId, product.id, {
      priceCents: toCents(input.price),
      currency: input.currency,
      merchant: input.merchant,
      sourceUrl: input.url,
      availability: input.availability ?? null,
      shippingCents: input.shippingCost ? toCents(input.shippingCost) : null,
      source,
    });
  }
  return db.savedProduct.findUniqueOrThrow({ where: { id: product.id } });
}

export function historyStats(obs: { priceCents: number }[]) {
  if (!obs.length) return null;
  const prices = obs.map((o) => o.priceCents);
  return { count: prices.length, lowCents: Math.min(...prices), highCents: Math.max(...prices), avgCents: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) };
}

/**
 * Deterministic price verdict from the user's own recorded observations.
 * Requires at least 3 observations; otherwise returns null rather than guessing.
 */
export function priceVerdict(currentCents: number, obs: { priceCents: number; observedAt: string }[]) {
  if (obs.length < 3) return null;
  const s = historyStats(obs)!;
  const first = obs.reduce((a, b) => (a.observedAt < b.observedAt ? a : b)).observedAt.slice(0, 10);
  const last = obs.reduce((a, b) => (a.observedAt > b.observedAt ? a : b)).observedAt.slice(0, 10);
  const basis = `Based on ${s.count} prices recorded in VELTRIX between ${first} and ${last}. This is your own observation history, not a market-wide price history.`;
  const vsAvg = ((currentCents - s.avgCents) / s.avgCents) * 100;
  if (currentCents <= s.lowCents) return { label: "Lowest price recorded", tone: "positive" as const, basis, vsAvgPercent: vsAvg };
  if (vsAvg <= -5) return { label: `${Math.abs(vsAvg).toFixed(0)}% below your recorded average`, tone: "positive" as const, basis, vsAvgPercent: vsAvg };
  if (vsAvg >= 5) return { label: `${vsAvg.toFixed(0)}% above your recorded average`, tone: "warning" as const, basis, vsAvgPercent: vsAvg };
  return { label: "In line with recorded prices", tone: "neutral" as const, basis, vsAvgPercent: vsAvg };
}

export async function listProducts(userId: string, status?: string) {
  const rows = await db.savedProduct.findMany({
    where: { userId, ...(status ? { status: status as "WISHLIST" } : { status: { not: "ARCHIVED" } }) },
    include: { observations: { orderBy: { observedAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(serializeProduct);
}

function serializeProduct(p: Awaited<ReturnType<typeof db.savedProduct.findFirstOrThrow>> & { observations: { price: unknown; observedAt: Date; merchant: string; source: string; currency: string }[] }) {
  const obs = p.observations.map((o) => ({ priceCents: cents(o.price as never), observedAt: o.observedAt.toISOString(), merchant: o.merchant, source: o.source, currency: o.currency }));
  const latest = centsOrNull(p.latestPrice);
  return {
    id: p.id,
    title: p.title,
    merchant: p.merchant,
    url: p.url,
    imageUrl: p.imageUrl,
    currency: p.currency,
    latestPriceCents: latest,
    latestSeenAt: p.latestSeenAt?.toISOString() ?? null,
    targetPriceCents: centsOrNull(p.targetPrice),
    status: p.status,
    brand: p.brand,
    gtin: p.gtin,
    notes: p.notes,
    source: p.source,
    createdAt: p.createdAt.toISOString(),
    observations: obs,
    stats: historyStats(obs),
    verdict: latest !== null ? priceVerdict(latest, obs) : null,
  };
}
export type SerializedProduct = ReturnType<typeof serializeProduct>;

export async function getProduct(userId: string, id: string) {
  const p = await db.savedProduct.findFirst({ where: { id, userId }, include: { observations: { orderBy: { observedAt: "asc" } } } });
  if (!p) throw notFound("Product");
  return serializeProduct(p);
}

export async function updateProduct(userId: string, id: string, input: z.infer<typeof productUpdateSchema>) {
  const p = await db.savedProduct.findFirst({ where: { id, userId } });
  if (!p) throw notFound("Product");
  return db.savedProduct.update({
    where: { id },
    data: { status: input.status, notes: input.notes, targetPrice: input.targetPrice === undefined ? undefined : input.targetPrice ? decStr(input.targetPrice) : null },
  });
}

export async function deleteProduct(userId: string, id: string) {
  const p = await db.savedProduct.findFirst({ where: { id, userId } });
  if (!p) throw notFound("Product");
  await db.savedProduct.delete({ where: { id } });
}

/** Same product (by GTIN, or brand+SKU) saved from other merchants — only prices the user actually observed. */
export async function alternativesFor(userId: string, p: { id?: string; gtin: string | null; sku: string | null; brand: string | null; canonicalUrl?: string }) {
  if (!p.gtin && !(p.sku && p.brand)) return [];
  const rows = await db.savedProduct.findMany({
    where: {
      userId,
      ...(p.id ? { id: { not: p.id } } : {}),
      ...(p.canonicalUrl ? { canonicalUrl: { not: p.canonicalUrl } } : {}),
      latestPrice: { not: null },
      OR: [...(p.gtin ? [{ gtin: p.gtin }] : []), ...(p.sku && p.brand ? [{ sku: p.sku, brand: p.brand }] : [])],
    },
    take: 5,
  });
  return rows.map((r) => ({ title: r.title, merchant: r.merchant, priceCents: cents(r.latestPrice), currency: r.currency, url: r.url, observedAt: r.latestSeenAt?.toISOString() ?? r.updatedAt.toISOString() }));
}

// ---------------------------------------------------------------- deals

export async function listDeals(userId: string) {
  const rows = await db.deal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
  const today = ymd(new Date());
  return rows.map((d) => {
    const expired = d.verification === "EXPIRED" || (d.expiresAt ? ymd(d.expiresAt) < today : false);
    const price = centsOrNull(d.price);
    const prev = centsOrNull(d.previousPrice);
    return {
      id: d.id,
      title: d.title,
      merchant: d.merchant,
      url: d.url,
      currency: d.currency,
      priceCents: price,
      previousPriceCents: prev,
      savingsCents: price !== null && prev !== null ? prev - price : null,
      couponCode: d.couponCode,
      couponConditions: d.couponConditions,
      cashbackRate: d.cashbackRate ? Number(d.cashbackRate.toString()) : null,
      shippingCents: centsOrNull(d.shippingCost),
      totalCents: price !== null ? price + (centsOrNull(d.shippingCost) ?? 0) : null,
      verification: expired ? "EXPIRED" : d.verification,
      confidence: d.confidence,
      source: d.source,
      lastCheckedAt: d.lastCheckedAt.toISOString(),
      expiresAt: d.expiresAt ? ymd(d.expiresAt) : null,
      savedProductId: d.savedProductId,
    };
  });
}

export async function createDeal(userId: string, input: z.infer<typeof dealCreateSchema>) {
  return db.deal.create({
    data: {
      userId,
      title: input.title,
      merchant: input.merchant,
      url: input.url,
      currency: input.currency,
      price: input.price ? decStr(input.price) : null,
      couponCode: input.couponCode ?? null,
      couponConditions: input.couponConditions ?? null,
      cashbackRate: input.cashbackRate ? decStr(input.cashbackRate) : null,
      shippingCost: input.shippingCost ? decStr(input.shippingCost) : null,
      expiresAt: input.expiresAt ? fromYmd(input.expiresAt) : null,
      verification: "USER_REPORTED",
      confidence: "LOW",
      source: "MANUAL",
    },
  });
}

export async function deleteDeal(userId: string, id: string) {
  const d = await db.deal.findFirst({ where: { id, userId } });
  if (!d) throw notFound("Deal");
  await db.deal.delete({ where: { id } });
}

// ---------------------------------------------------------------- rewards

export async function listRewards(userId: string) {
  const rows = await db.rewardProgram.findMany({ where: { userId }, orderBy: { balance: "desc" } });
  return rows.map((r) => {
    const cpp = r.pointValueCents ? Number(r.pointValueCents.toString()) : null;
    return {
      id: r.id,
      name: r.name,
      programType: r.programType,
      balance: r.balance,
      pointValueCents: cpp,
      estimatedValueCents: cpp !== null ? Math.round(r.balance * cpp) : null,
      expiresAt: r.expiresAt ? ymd(r.expiresAt) : null,
      source: r.source,
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

export async function upsertReward(userId: string, input: z.infer<typeof rewardProgramSchema>, id?: string) {
  const data = {
    name: input.name,
    programType: input.programType,
    balance: input.balance,
    pointValueCents: input.pointValueCents ? decStr(input.pointValueCents) : null,
    expiresAt: input.expiresAt ? fromYmd(input.expiresAt) : null,
  };
  if (id) {
    const r = await db.rewardProgram.findFirst({ where: { id, userId } });
    if (!r) throw notFound("Reward program");
    return db.rewardProgram.update({ where: { id }, data });
  }
  return db.rewardProgram.create({ data: { ...data, userId } });
}

export async function deleteReward(userId: string, id: string) {
  const r = await db.rewardProgram.findFirst({ where: { id, userId } });
  if (!r) throw notFound("Reward program");
  await db.rewardProgram.delete({ where: { id } });
}
