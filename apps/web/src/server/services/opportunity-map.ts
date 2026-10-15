/**
 * Gathers the user's data for the Personal Opportunity Map (the scoring itself is the shared,
 * pure `buildOpportunityMap`). Priorities are stored on UserPreference so they work even when
 * financial memory is switched off.
 */
import { buildOpportunityMap, KIND_AREA, MAP_AREA_IDS, totalPotentialSavings, type MapAreaId, type MapInput } from "@veltrix/shared";
import { db } from "../db";
import { cents } from "../money";
import { todayIn, fromYmd } from "../dates";
import { buildProfile } from "./twin";
import { listInsights, refreshInsights } from "./insights";

interface Ctx {
  timezone: string;
  currency: string;
}
const PER_YEAR = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1, UNKNOWN: 0 } as const;
const valid = (xs: string[]) => xs.filter((x): x is MapAreaId => (MAP_AREA_IDS as string[]).includes(x));

export async function mapPreferences(userId: string) {
  const p = await db.userPreference.findUnique({ where: { userId }, select: { focusAreas: true, hiddenAreas: true } });
  return { focus: valid(p?.focusAreas ?? []), hidden: valid(p?.hiddenAreas ?? []) };
}

export async function setMapPreferences(userId: string, input: { focus?: MapAreaId[]; hidden?: MapAreaId[] }) {
  const cur = await mapPreferences(userId);
  const focus = input.focus ?? cur.focus;
  // Choosing an area as a focus un-hides it.
  const hidden = (input.hidden ?? cur.hidden).filter((h) => !focus.includes(h));
  await db.userPreference.upsert({ where: { userId }, create: { userId, focusAreas: focus, hiddenAreas: hidden }, update: { focusAreas: focus, hiddenAreas: hidden } });
  return { focus, hidden };
}

export async function mapInput(userId: string, ctx: Ctx): Promise<MapInput> {
  const today = todayIn(ctx.timezone);
  const latest = await db.financialInsight.findFirst({ where: { userId }, orderBy: { generatedAt: "desc" }, select: { generatedAt: true } });
  if (!latest || Date.now() - latest.generatedAt.getTime() > 60 * 60 * 1000) await refreshInsights(userId, ctx.timezone, ctx.currency);

  const [profile, recurring, products, trips, holdings, transactions, uncategorized, insights, nonPurchaseGoals] = await Promise.all([
    buildProfile(userId, ctx),
    db.recurringPayment.findMany({ where: { userId, status: { not: "DISMISSED" }, currency: ctx.currency } }),
    db.savedProduct.findMany({ where: { userId, status: { in: ["WISHLIST", "WATCHING"] } }, select: { latestPrice: true, targetPrice: true } }),
    db.travelPlan.findMany({ where: { userId, status: { in: ["PLANNING", "BOOKED"] }, OR: [{ endDate: null }, { endDate: { gte: fromYmd(today) } }] }, include: { expenses: { where: { isQuote: false } } } }),
    db.investmentHolding.count({ where: { userId } }),
    db.transaction.count({ where: { userId } }),
    db.transaction.count({ where: { userId, categoryId: null } }),
    listInsights(userId, 100),
    db.savingsGoal.findMany({ where: { userId, kind: { in: ["EMERGENCY_FUND", "DEBT", "RETIREMENT"] } }, select: { id: true } }),
  ]);
  const skipGoal = new Set(nonPurchaseGoals.map((g) => g.id));

  const byMerchant = new Map<string, { name: string; n: number }>();
  for (const r of recurring) byMerchant.set(r.merchantKey, { name: r.merchant, n: (byMerchant.get(r.merchantKey)?.n ?? 0) + 1 });

  const opportunities: MapInput["opportunities"] = {};
  for (const id of MAP_AREA_IDS) {
    const items = insights.filter((i) => KIND_AREA[i.kind] === id);
    if (items.length) opportunities[id] = { count: items.length, potentialAnnualCents: totalPotentialSavings(items.filter((o) => o.estimateType === "POTENTIAL" || o.savingsParts.length)) };
  }

  const f = profile.figures;
  return {
    currency: ctx.currency,
    hasAccounts: profile.accounts.length > 0,
    incomeCents: f.income.cents,
    essentialCents: f.essential.cents,
    discretionaryCents: f.discretionary.cents,
    surplusCents: f.surplus.cents,
    liquidCents: f.liquid.cents,
    emergencyTargetMonths: profile.assumptions.emergencyMonths,
    debts: profile.debts.map((d) => ({ name: d.name, balanceCents: d.balanceCents, aprPercent: d.aprPercent })),
    recurring: {
      count: recurring.length,
      monthlyCents: Math.round(recurring.reduce((s, r) => s + (cents(r.amount) * PER_YEAR[r.frequency]) / 12, 0)),
      duplicateMerchants: [...byMerchant.values()].filter((v) => v.n > 1).map((v) => v.name),
    },
    goals: profile.goals.filter((g) => !skipGoal.has(g.id)).map((g) => ({ name: g.name, targetCents: g.targetCents, savedCents: g.savedCents, monthlyCents: g.monthlyCents, targetMonth: g.targetMonth })),
    products: {
      active: products.length,
      withTarget: products.filter((p) => p.targetPrice !== null).length,
      atOrBelowTarget: products.filter((p) => p.targetPrice !== null && p.latestPrice !== null && Number(p.latestPrice) <= Number(p.targetPrice)).length,
    },
    trips: {
      upcoming: trips.length,
      withoutBudget: trips.filter((t) => t.budget === null).length,
      overBudget: trips
        .filter((t) => t.budget !== null)
        .map((t) => ({ name: t.name, overCents: t.expenses.filter((e) => e.currency === t.currency).reduce((s, e) => s + cents(e.amount), 0) - cents(t.budget!) }))
        .filter((t) => t.overCents > 0),
    },
    investments: { cents: f.investments.cents, holdings },
    records: { transactions, uncategorized, staleAccounts: profile.accounts.filter((a) => a.stale).length, monthsOfHistory: profile.monthsOfHistory, issues: profile.issues.length },
    accounts: profile.accounts.length,
    opportunities,
  };
}

export async function opportunityMap(userId: string, ctx: Ctx) {
  const [input, prefs] = await Promise.all([mapInput(userId, ctx), mapPreferences(userId)]);
  return { ...buildOpportunityMap(input, prefs), prefs, currency: ctx.currency, asOf: new Date().toISOString() };
}
export type OpportunityMapResult = Awaited<ReturnType<typeof opportunityMap>>;
