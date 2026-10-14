/**
 * Opportunity graph. Deterministic, explainable opportunities that connect related
 * records across the user's finances (a renewal and the budget it lands in, a trip and
 * the goal it delays, a price drop and the plan it does or doesn't fit). Each one states:
 *   the event (title/summary), why it matters (rationale), how numbers were calculated,
 *   assumptions, the records it connects (links), confidence and its basis, when it was
 *   last verified, a next action, and its status/outcome.
 * Potential savings are never shown as confirmed, and the same saving is never counted
 * twice (see totalPotentialSavings).
 */
import type { Prisma } from "@prisma/client";
import {
  comparePlans,
  detectPriceIncrease,
  formatMoney,
  monthlyCashflow,
  rankOpportunity,
  simulatePlan,
  spendingBreakdown,
  spendingSpike,
  totalPotentialSavings,
  type ImpactType,
  type OpportunityConfidence,
} from "@veltrix/shared";
import { db } from "../db";
import { dec, cents } from "../money";
import { addDays, addMonths, daysInMonth, fromYmd, monthStart, todayIn } from "../dates";
import { notFound } from "../errors";
import { listAccounts } from "./accounts";
import { budgetStatusForMonth } from "./budgets";
import { listGoals } from "./goals";
import { listRecurring, refreshRecurring } from "./recurring";
import { listProducts } from "./shopping";
import { listTrips } from "./travel";
import { txnsForRange } from "./transactions";
import { notify } from "./notifications";
import { buildProfile } from "./twin";
import { decidePurchase } from "./plan";

export interface OpportunityLink {
  type: "recurring" | "budget" | "goal" | "product" | "trip" | "account" | "instrument" | "article" | "plan";
  id: string;
  name: string;
  href: string;
}

export interface EvidenceRow {
  label: string;
  value: string;
}

export interface InsightDraft {
  kind: string;
  dedupeKey: string;
  title: string;
  summary: string;
  rationale: string;
  calculation: string;
  assumptions: string[];
  action: string;
  actionHref?: string;
  estimateCents?: number | null;
  estimateType: ImpactType;
  evidence?: { rows: EvidenceRow[]; savingsParts?: { key: string; cents: number }[] };
  priority: number;
  links: OpportunityLink[];
  confidence: OpportunityConfidence;
  confidenceBasis: string;
  eventDate?: string | null;
}

export const OPPORTUNITY_KINDS: Record<string, string> = {
  renewal_over_budget: "Renewals while over budget",
  bill_increase: "Recurring price increases",
  commitments_vs_cash: "Upcoming bills vs. cash",
  trip_vs_goal: "Trips that affect goals",
  price: "Price drops on saved products",
  research_holding: "Research about your holdings",
  subscriptions: "Subscriptions to review",
  budget: "Budget alerts",
  goal: "Goals off track",
  emergency_fund: "Emergency fund",
  spending_spike: "Spending running high",
  idle_cash: "Cash in checking",
  trip: "Trips over budget",
  savings_rate: "Savings rate",
};

const ESSENTIAL = new Set(["housing", "utilities", "food", "transport", "health"]);
const PER_YEAR = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1, UNKNOWN: 0 } as const;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export async function computeInsights(userId: string, timezone = "UTC", currency = "USD"): Promise<InsightDraft[]> {
  const today = todayIn(timezone);
  const ym = today.slice(0, 7);
  const out: InsightDraft[] = [];
  const fmt = (c: number) => formatMoney(c, currency);

  await refreshRecurring(userId, timezone);
  const [recurring, budgets, goals, accounts, products, trips, last3, thisMonth, profile, articles, holdings, watch] = await Promise.all([
    listRecurring(userId),
    budgetStatusForMonth(userId, ym, timezone),
    listGoals(userId, timezone),
    listAccounts(userId),
    listProducts(userId),
    listTrips(userId),
    txnsForRange(userId, monthStart(addMonths(ym, -3)), monthStart(ym), currency),
    txnsForRange(userId, monthStart(ym), addDays(today, 1), currency),
    buildProfile(userId, { timezone, currency }),
    db.savedArticle.findMany({ where: { userId, createdAt: { gte: fromYmd(addDays(today, -30)) } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, mentionedSymbols: true, publisher: true, createdAt: true } }),
    db.investmentHolding.findMany({ where: { userId }, select: { instrument: { select: { symbol: true, name: true } } } }),
    db.watchlistItem.findMany({ where: { watchlist: { userId } }, select: { instrument: { select: { symbol: true, name: true } } } }),
  ]);
  const activeLines = budgets.filter((b) => !b.archived).flatMap((b) => b.lines);
  const live = recurring.filter((r) => r.status !== "DISMISSED" && r.currency === currency);
  /** Yearly cost at the latest charge, which reflects any recent price change. */
  const latestAnnual = (r: (typeof recurring)[number]) => Math.abs(r.evidence[r.evidence.length - 1]?.amountCents ?? r.amountCents) * PER_YEAR[r.frequency];
  const recLink = (r: (typeof recurring)[number]): OpportunityLink => ({ type: "recurring", id: r.id, name: r.merchant, href: "/app/savings#subscriptions" });
  const recConfidence = (r: (typeof recurring)[number]): [OpportunityConfidence, string] =>
    r.status === "CONFIRMED" ? ["high", "You confirmed this recurring charge."] : [r.occurrences >= 4 ? "medium" : "low", `Detected from ${r.occurrences} past charges; not yet confirmed by you.`];

  // A. A renewal is coming up in a category that's already over (or near) budget
  for (const r of live) {
    if (!r.nextExpected || r.nextExpected < today || daysBetween(today, r.nextExpected) > 14) continue;
    const line = activeLines.find((l) => l.category.slug === r.category?.slug && l.health !== "ok");
    if (!line) continue;
    // The next charge most likely matches the latest one (which reflects any price change).
    const nextCharge = Math.abs(r.evidence[r.evidence.length - 1]?.amountCents ?? r.amountCents);
    const after = line.spentCents + nextCharge;
    const [confidence, basis] = recConfidence(r);
    out.push({
      kind: "renewal_over_budget",
      dedupeKey: `renewal:${r.id}:${r.nextExpected}`,
      title: `${r.merchant} renews ${shortDay(r.nextExpected)} while ${line.category.name} is ${line.health === "over" ? "over budget" : `at ${Math.round(line.percentUsed)}% of its budget`}`,
      summary: `The ${fmt(nextCharge)} charge would bring ${line.category.name} to ${fmt(after)} of its ${fmt(line.limitCents)} limit. Reviewing it before it renews is the easiest point to decide.`,
      rationale: "A renewal you no longer need is simplest to stop before it charges, and this one lands in a category that's already stretched.",
      calculation: `${fmt(line.spentCents)} spent + ${fmt(nextCharge)} renewal (same as the latest charge) = ${fmt(after)} vs ${fmt(line.limitCents)} limit. Cancelling would avoid about ${fmt(nextCharge * PER_YEAR[r.frequency])} a year.`,
      assumptions: ["Renewal date and amount are inferred from past charges and may differ.", "Any saving only happens if you cancel or downgrade."],
      action: "Review subscription",
      actionHref: "/app/savings#subscriptions",
      estimateCents: nextCharge,
      estimateType: "CONFIRMED",
      evidence: {
        rows: [
          { label: "Next charge (expected)", value: `${fmt(nextCharge)} on ${shortDay(r.nextExpected)}` },
          { label: `${line.category.name} this month`, value: `${fmt(line.spentCents)} of ${fmt(line.limitCents)}` },
          ...r.evidence.slice(-3).map((e) => ({ label: `Charged ${shortDay(e.date)}`, value: fmt(Math.abs(e.amountCents)) })),
        ],
        savingsParts: [{ key: `rec:${r.id}`, cents: latestAnnual(r) }],
      },
      priority: 75,
      links: [recLink(r), { type: "budget", id: line.lineId, name: `${line.category.name} budget`, href: "/app/budgets" }],
      confidence,
      confidenceBasis: basis,
      eventDate: r.nextExpected,
    });
  }

  // B. A recurring charge went up
  for (const r of live) {
    const change = detectPriceIncrease(r.evidence);
    if (!change || daysBetween(change.latestDate, today) > 60) continue;
    const annual = change.increaseCents * PER_YEAR[r.frequency];
    out.push({
      kind: "bill_increase",
      dedupeKey: `billup:${r.id}:${change.latestDate}`,
      title: `${r.merchant} went up ${change.percent}%`,
      summary: `From ${fmt(change.previousCents)} to ${fmt(change.latestCents)}: about ${fmt(annual)} more a year, which lowers what's left each month by ${fmt(Math.round(annual / 12))}.`,
      rationale: "Price increases on recurring charges are easy to miss, and they quietly reduce the surplus your goals depend on.",
      calculation: `Latest charge ${fmt(change.latestCents)} − typical earlier charge ${fmt(change.previousCents)} (median) = ${fmt(change.increaseCents)} × ${PER_YEAR[r.frequency]} charges a year = ${fmt(annual)}.`,
      assumptions: ["Assumes the new price continues.", "A one-off extra (like a pro-rated charge) can look like an increase."],
      action: "Review recurring charges",
      actionHref: "/app/savings#subscriptions",
      estimateCents: annual,
      estimateType: "CONFIRMED",
      evidence: { rows: r.evidence.slice(-4).map((e) => ({ label: `Charged ${shortDay(e.date)}`, value: fmt(Math.abs(e.amountCents)) })) },
      priority: 60,
      links: [recLink(r), { type: "plan", id: "profile", name: "Your monthly plan", href: "/app/plan?tab=profile" }],
      confidence: r.evidence.length >= 4 ? "high" : "medium",
      confidenceBasis: `Based on ${r.evidence.length} recorded charges from ${r.merchant}.`,
      eventDate: r.nextExpected,
    });
  }

  // C. Upcoming bills vs. available cash
  const cash = profile.figures.liquid.cents;
  const essential = profile.figures.essential.cents;
  if (cash !== null && profile.commitments.length) {
    const due = profile.commitments.reduce((s, c) => s + c.amountCents, 0);
    const left = cash - due;
    const floor = essential ? Math.round(essential / 2) : 0;
    if (left < floor) {
      const allConfirmed = profile.commitments.every((c) => c.confirmed);
      out.push({
        kind: "commitments_vs_cash",
        dedupeKey: `commit:${ym}:${profile.commitments[0].due}`,
        title: `Upcoming bills leave ${fmt(left)} in cash`,
        summary: `${profile.commitments.length} recurring charge${profile.commitments.length === 1 ? "" : "s"} totaling ${fmt(due)} are due in the next 30 days${essential ? `, leaving less than half a month of essential spending (${fmt(floor)})` : ""}. Large discretionary purchases may be worth timing after payday.`,
        rationale: "Knowing what's already committed keeps a purchase or transfer from causing an overdraft.",
        calculation: `Cash ${fmt(cash)} − ${fmt(due)} due by ${shortDay(addDays(today, 30))} = ${fmt(left)}${essential ? `; half a month of essentials = ${fmt(floor)}` : ""}.`,
        assumptions: ["Income arriving in the next 30 days isn't counted here.", profile.figures.liquid.stale ? "At least one balance is out of date." : "Uses your latest balances."],
        action: "Review your picture",
        actionHref: "/app/plan?tab=profile",
        estimateCents: due,
        estimateType: "CONFIRMED",
        evidence: { rows: profile.commitments.slice(0, 6).map((c) => ({ label: `${c.merchant} · ${shortDay(c.due)}`, value: fmt(c.amountCents) })) },
        priority: 70,
        links: profile.commitments.slice(0, 4).map((c) => ({ type: "recurring" as const, id: c.id, name: c.merchant, href: "/app/savings#subscriptions" })),
        confidence: profile.figures.liquid.stale ? "low" : allConfirmed ? "high" : "medium",
        confidenceBasis: profile.figures.liquid.stale ? "A balance hasn't been updated recently." : allConfirmed ? "All upcoming charges are confirmed by you." : "Some upcoming charges are detected, not confirmed.",
        eventDate: profile.commitments[0].due,
      });
    }
  }

  // D. An upcoming trip would delay a goal (plan engine)
  if (profile.canProject) {
    const base = simulatePlan(profile.baseline, [], 24, profile.assumptions).summary;
    for (const t of trips) {
      if (!t.startDate || t.startDate < today || t.status === "CANCELLED" || t.status === "COMPLETED" || t.currency !== currency) continue;
      const remaining = t.projectedCents - t.spentCents;
      const monthOffset = (Number(t.startDate.slice(0, 4)) - Number(ym.slice(0, 4))) * 12 + Number(t.startDate.slice(5, 7)) - Number(ym.slice(5, 7));
      if (remaining <= 0 || monthOffset > 18) continue;
      const withTrip = simulatePlan(profile.baseline, [{ kind: "one_time", label: t.name, amountCents: remaining, month: Math.max(0, monthOffset) }], 24, profile.assumptions).summary;
      const cmp = comparePlans(base, withTrip);
      const hit = cmp.goalDelays.find((g) => g.becameOffTrack || (g.delayMonths ?? 0) >= 1);
      if (!hit && !cmp.newlyNegative) continue;
      const goalLink = hit ? goals.find((g) => g.id === hit.id) : null;
      out.push({
        kind: "trip_vs_goal",
        dedupeKey: `tripgoal:${t.id}:${remaining}:${hit?.id ?? "cash"}`,
        title: cmp.newlyNegative ? `${t.name} could push your cash below zero` : `${t.name} would push "${hit!.name}" back ${hit!.delayMonths ? `${hit!.delayMonths} month${hit!.delayMonths === 1 ? "" : "s"}` : "past its target date"}`,
        summary: `The trip's remaining ${fmt(remaining)} (saved quotes plus anything not yet spent) lands around ${shortDay(t.startDate)}. Setting money aside for it ahead of time, or trimming the plan, keeps your goals on schedule.`,
        rationale: "Trips and savings goals draw on the same monthly surplus.",
        calculation: `Plan engine: ${fmt(remaining)} one-time cost in month ${monthOffset + 1}. ${hit ? `"${hit.name}" completes ${hit.scenarioMonth === null ? "outside the 24-month window" : `in month ${hit.scenarioMonth + 1}`} instead of ${hit.baselineMonth === null ? "outside the window" : `month ${hit.baselineMonth + 1}`}.` : `Lowest cash ${fmt(withTrip.lowestLiquid.cents)}.`}`,
        assumptions: ["Uses your saved quotes, which may change.", "Goal contributions come from monthly surplus; months without surplus skip them."],
        action: "Explore in the What-if Lab",
        actionHref: "/app/plan?tab=whatif&preset=vacation",
        estimateCents: remaining,
        estimateType: "CONFIRMED",
        evidence: { rows: [{ label: "Spent so far", value: fmt(t.spentCents) }, { label: "Saved quotes", value: fmt(t.quotedCents) }, ...(t.budgetCents !== null ? [{ label: "Trip budget", value: fmt(t.budgetCents) }] : [])] },
        priority: 65,
        links: [{ type: "trip", id: t.id, name: t.name, href: "/app/travel" }, ...(goalLink ? [{ type: "goal" as const, id: goalLink.id, name: goalLink.name, href: "/app/goals" }] : [])],
        confidence: "medium",
        confidenceBasis: `Projection from your ${profile.monthsOfHistory ? `last ${profile.monthsOfHistory} months of` : "budgeted"} spending and entered income.`,
        eventDate: t.startDate,
      });
    }
  }

  // E. Saved product at a good price — and whether it fits the plan
  const deals = products.filter((x) => x.verdict?.tone === "positive" && x.status !== "PURCHASED" && x.latestPriceCents !== null && x.currency === currency).slice(0, 3);
  for (const p of deals) {
    let fit: Awaited<ReturnType<typeof decidePurchase>> | null = null;
    try {
      fit = await decidePurchase(userId, { label: p.title.slice(0, 80), priceCents: p.latestPriceCents!, categorySlug: "shopping", horizonMonths: 24 }, { timezone, currency });
    } catch {
      fit = null;
    }
    const goalHits = fit ? fit.options[0].vsSkip.goalDelays.filter((g) => (g.delayMonths ?? 0) >= 1 || g.becameOffTrack || (g.delayMonths === null && g.endSavedDeltaCents < 0)) : [];
    const name = p.title.length > 48 ? `${p.title.slice(0, 47)}…` : p.title;
    const fits = fit?.verdict === "fits";
    const belowAvg = p.stats ? p.stats.avgCents - p.latestPriceCents! : 0;
    out.push({
      kind: "price",
      dedupeKey: `price:${p.id}:${p.latestPriceCents}`,
      title: fit && fit.verdict !== "unknown" ? (fits ? `${name} is at a good price, and it fits your plan` : `${name} is at a good price, but buying now has trade-offs`) : `${name}: ${p.verdict!.label.toLowerCase()}`,
      summary: `Last seen at ${fmt(p.latestPriceCents!)} at ${p.merchant}${belowAvg > 0 ? `, ${fmt(belowAvg)} below the average you've recorded` : ""}.${fit && !fits && fit.verdict !== "unknown" ? ` ${fit.reasons[0]?.text ?? ""}` : ""}`,
      rationale: "You saved this product to watch its price; this connects the price to your goals.",
      calculation: `${p.verdict!.basis}${fit ? ` Plan check: ${fit.reasons.map((r) => r.text).join(" ")}` : ""}`,
      assumptions: ["Prices are those you recorded; other retailers may differ and prices change.", "Buying spends money; a lower price isn't a saving unless you were going to buy anyway."],
      action: fits ? "View price history" : "Compare buy now vs. later",
      actionHref: fits ? `/app/shopping?product=${p.id}` : `/app/plan?tab=decide&item=${encodeURIComponent(p.title.slice(0, 50))}&price=${(p.latestPriceCents! / 100).toFixed(2)}`,
      estimateCents: belowAvg > 0 ? belowAvg : null,
      estimateType: belowAvg > 0 ? "POTENTIAL" : "NONE",
      evidence: { rows: [{ label: "Latest price", value: fmt(p.latestPriceCents!) }, ...(p.stats ? [{ label: "Recorded range", value: `${fmt(p.stats.lowCents)} – ${fmt(p.stats.highCents)} (${p.stats.count} prices)` }] : [])] },
      priority: fits ? 45 : 50,
      links: [{ type: "product", id: p.id, name, href: `/app/shopping?product=${p.id}` }, ...goalHits.slice(0, 2).map((g) => ({ type: "goal" as const, id: g.id, name: g.name, href: "/app/goals" }))],
      confidence: (p.stats?.count ?? 0) >= 5 ? "high" : "medium",
      confidenceBasis: `Price verdict from ${p.stats?.count ?? 0} prices you recorded${fit ? "; plan check uses your current picture" : ""}.`,
      eventDate: null,
    });
  }

  // F. Saved research mentions something you own or watch
  const held = new Map(holdings.map((h) => [h.instrument.symbol, h.instrument.name]));
  const watched = new Map(watch.map((w) => [w.instrument.symbol, w.instrument.name]));
  let researchCount = 0;
  for (const a of articles) {
    for (const sym of a.mentionedSymbols) {
      if (researchCount >= 3) break;
      const inHoldings = held.has(sym);
      if (!inHoldings && !watched.has(sym)) continue;
      researchCount++;
      out.push({
        kind: "research_holding",
        dedupeKey: `research:${a.id}:${sym}`,
        title: `An article you saved mentions ${sym}, ${inHoldings ? "which you hold" : "on your watchlist"}`,
        summary: `"${a.title.slice(0, 120)}"${a.publisher ? ` (${a.publisher})` : ""}. Review it alongside ${sym}'s price and your ${inHoldings ? "position" : "research notes"}.`,
        rationale: "Connecting new research to what you already own or follow keeps decisions in context.",
        calculation: `${sym} appears in the article's detected tickers and in your ${inHoldings ? "holdings" : "watchlist"}.`,
        assumptions: ["Ticker detection can match unrelated uses of the same letters.", "This is information, not an investment recommendation."],
        action: `Open ${sym}`,
        actionHref: `/app/markets/${encodeURIComponent(sym)}`,
        estimateType: "NONE",
        evidence: { rows: [{ label: "Saved", value: a.createdAt.toISOString().slice(0, 10) }] },
        priority: 25,
        links: [{ type: "article", id: a.id, name: a.title.slice(0, 40), href: "/app/markets" }, { type: "instrument", id: sym, name: `${sym}${(held.get(sym) ?? watched.get(sym)) ? ` · ${held.get(sym) ?? watched.get(sym)}` : ""}`, href: `/app/markets/${encodeURIComponent(sym)}` }],
        confidence: "medium",
        confidenceBasis: "Matched by ticker symbol only.",
        eventDate: null,
      });
    }
  }

  // 1. Subscriptions worth reviewing
  const subs = live.filter((r) => ["subscriptions", "entertainment"].includes(r.category?.slug ?? "subscriptions"));
  if (subs.length) {
    const annual = subs.reduce((s, r) => s + latestAnnual(r), 0);
    const suspected = subs.filter((s) => s.status === "SUSPECTED").length;
    out.push({
      kind: "subscriptions",
      dedupeKey: `subscriptions:${ym}`,
      title: `Review ${subs.length} recurring subscription${subs.length > 1 ? "s" : ""}`,
      summary: `These charges add up to about ${fmt(annual)} a year. Cancelling any you no longer use is the simplest saving available.`,
      rationale: `VELTRIX found ${subs.length} charges that repeat on a regular schedule${suspected ? `; ${suspected} are inferred from your transactions and not yet confirmed by you` : ""}.`,
      calculation: subs
        .slice(0, 6)
        .map((s) => `${s.merchant}: latest ${fmt(latestAnnual(s) / PER_YEAR[s.frequency])} × ${s.frequency.toLowerCase()} → ${fmt(latestAnnual(s))}/yr`)
        .join("; "),
      assumptions: ["Amounts and frequency are inferred from past charges and may change.", "The saving is only realised for subscriptions you actually cancel."],
      action: "Review subscriptions",
      actionHref: "/app/savings#subscriptions",
      estimateCents: annual,
      estimateType: "POTENTIAL",
      evidence: { rows: subs.slice(0, 6).map((s) => ({ label: `${s.merchant}${s.status === "SUSPECTED" ? " (detected)" : ""}`, value: `${fmt(s.amountCents)} ${s.frequency.toLowerCase()}` })), savingsParts: subs.map((s) => ({ key: `rec:${s.id}`, cents: latestAnnual(s) })) },
      priority: 55,
      links: subs.slice(0, 4).map(recLink),
      confidence: suspected === 0 ? "high" : suspected < subs.length ? "medium" : "low",
      confidenceBasis: suspected === 0 ? "All are confirmed by you." : `${suspected} of ${subs.length} are detected from transactions, not confirmed.`,
    });
  }

  // 2. Budget categories near or over their limit
  for (const b of budgets.filter((x) => !x.archived)) {
    for (const l of b.lines.filter((x) => x.health !== "ok")) {
      out.push({
        kind: "budget",
        dedupeKey: `budget:${l.lineId}:${ym}:${l.health}`,
        title: l.health === "over" ? `${l.category.name} is over budget` : `${l.category.name} is at ${Math.round(l.percentUsed)}% of its budget`,
        summary: l.health === "over" ? `You've spent ${fmt(l.spentCents)} against a ${fmt(l.limitCents)} limit this month.` : `${fmt(l.remainingCents)} remains for the rest of the month.`,
        rationale: `Your "${b.name}" budget warns at ${l.alertThreshold}% of each category's limit.`,
        calculation: `${fmt(l.spentCents)} spent ÷ ${fmt(l.limitCents)} limit = ${l.percentUsed.toFixed(1)}%.`,
        assumptions: ["Only transactions recorded in VELTRIX this month are counted.", "Transfers between your own accounts are excluded."],
        action: "Open budget",
        actionHref: "/app/budgets",
        estimateType: "NONE",
        priority: l.health === "over" ? 80 : 60,
        links: [{ type: "budget", id: l.lineId, name: `${l.category.name} budget`, href: "/app/budgets" }],
        confidence: "high",
        confidenceBasis: "Calculated from this month's transactions and your budget.",
      });
    }
  }

  // 3. Goals that are off track
  for (const g of goals.filter((x) => x.projection.onTrack === false)) {
    const gap = (g.projection.requiredMonthlyCents ?? 0) - (g.plannedMonthlyCents ?? 0);
    out.push({
      kind: "goal",
      dedupeKey: `goal:${g.id}:${ym}`,
      title: `${g.name} needs ${fmt(g.projection.requiredMonthlyCents ?? 0)}/month to stay on schedule`,
      summary: `You plan to save ${fmt(g.plannedMonthlyCents ?? 0)}/month, ${fmt(gap)} short of what's needed by ${g.targetDate}.`,
      rationale: `${g.projection.percent}% of ${fmt(g.targetCents)} is saved with ${g.projection.monthsLeft} months left.`,
      calculation: `${fmt(g.projection.remainingCents)} remaining ÷ ${g.projection.monthsLeft} months = ${fmt(g.projection.requiredMonthlyCents ?? 0)}/month.`,
      assumptions: g.projection.assumptions,
      action: "Try saving more in the What-if Lab",
      actionHref: "/app/plan?tab=whatif&preset=save",
      estimateType: "NONE",
      priority: 60,
      links: [{ type: "goal", id: g.id, name: g.name, href: "/app/goals" }],
      confidence: "high",
      confidenceBasis: "Calculated from the goal's target, date and your planned monthly amount.",
      eventDate: g.targetDate,
    });
  }

  // 4. Emergency fund coverage
  const essential3 = last3.filter((t) => t.amountCents < 0 && ESSENTIAL.has(t.categorySlug ?? "")).reduce((s, t) => s - t.amountCents, 0);
  const monthlyEssential = Math.round(essential3 / 3);
  const liquid = accounts.filter((a) => ["CHECKING", "SAVINGS", "CASH"].includes(a.type) && a.currency === currency).reduce((s, a) => s + a.balanceCents, 0);
  if (monthlyEssential > 0 && last3.length >= 20) {
    const months = liquid / monthlyEssential;
    if (months < 3) {
      out.push({
        kind: "emergency_fund",
        dedupeKey: `emergency:${ym}`,
        title: `Cash covers about ${months.toFixed(1)} months of essentials`,
        summary: `A common guideline is 3–6 months. Reaching 3 months would take about ${fmt(Math.max(0, monthlyEssential * 3 - liquid))} more.`,
        rationale: "An emergency fund protects your plans from job loss or unexpected bills without relying on credit.",
        calculation: `Liquid balances ${fmt(liquid)} ÷ average essential spending ${fmt(monthlyEssential)}/month (housing, utilities, food, transport, health over the last 3 full months).`,
        assumptions: ["Essential categories are an approximation; adjust for your situation.", "Investment and retirement accounts are not counted as emergency cash."],
        action: "Run a stress test",
        actionHref: "/app/plan?tab=stress",
        estimateType: "NONE",
        priority: 55,
        links: [{ type: "plan", id: "stress", name: "Stress test", href: "/app/plan?tab=stress" }],
        confidence: "medium",
        confidenceBasis: "Based on 3 months of transactions; essential categories are an approximation.",
      });
    }
  }

  // 5. Category spending well above its recent average
  if (last3.length >= 20) {
    const avg = new Map(spendingBreakdown(last3).slices.map((s) => [s.group, s.totalCents / 3]));
    const dim = daysInMonth(ym);
    const day = Number(today.slice(8, 10));
    for (const s of spendingBreakdown(thisMonth).slices) {
      const base = Math.round(avg.get(s.group) ?? 0);
      const spike = spendingSpike({ group: s.group, spentCents: s.totalCents, txnCount: s.count, day, daysInMonth: dim, monthlyAverageCents: base });
      if (!spike) continue;
      const label = s.group === "food" ? "Food & dining" : s.group[0].toUpperCase() + s.group.slice(1);
      out.push({
        kind: "spending_spike",
        dedupeKey: `spike:${s.group}:${ym}`,
        title: `${label} spending is running high`,
        summary: spike.method === "pace" ? `At this pace you'll spend about ${fmt(spike.projectedCents)} this month, compared with a ${fmt(base)} monthly average.` : `You've already spent ${fmt(s.totalCents)} this month, compared with a ${fmt(base)} monthly average.`,
        rationale: "Catching a spending trend mid-month leaves time to adjust.",
        calculation:
          spike.method === "pace"
            ? `${fmt(s.totalCents)} across ${s.count} purchases in ${day} days, projected over ${dim} days = ${fmt(spike.projectedCents)}; average of the last 3 full months = ${fmt(base)}.`
            : `${fmt(s.totalCents)} spent so far this month (no projection); average of the last 3 full months = ${fmt(base)}.`,
        assumptions: spike.method === "pace" ? ["Assumes spending continues at the same daily pace.", "One large purchase can make the projection overstate the trend."] : ["Based only on money already spent; fixed bills like rent and utilities are never projected forward."],
        action: "See transactions",
        actionHref: "/app/transactions",
        estimateType: "NONE",
        priority: 50,
        links: [],
        confidence: spike.method === "pace" ? "low" : "medium",
        confidenceBasis: spike.method === "pace" ? "A projection from the month so far." : "Money already spent this month.",
      });
    }
  }

  // 6. Idle cash in checking
  const checking = accounts.filter((a) => a.type === "CHECKING" && a.currency === currency).reduce((s, a) => s + a.balanceCents, 0);
  const monthlySpend = Math.round(last3.filter((t) => t.amountCents < 0 && t.categoryKind !== "TRANSFER").reduce((s, t) => s - t.amountCents, 0) / 3);
  const idleExcess = checking - Math.round(monthlySpend * 1.5);
  // Needs a real spending history, and an amount where 1% is worth at least $1 a year.
  if (last3.length >= 20 && monthlySpend > 0 && checking > monthlySpend * 2 && idleExcess >= 10_000) {
    const excess = idleExcess;
    const perPct = Math.round(excess * 0.01);
    out.push({
      kind: "idle_cash",
      dedupeKey: `idle:${ym}`,
      title: "Compare savings rates for cash sitting in checking",
      summary: `About ${fmt(excess)} in checking is above 1.5 months of typical spending. Each 1% of interest on that amount is roughly ${fmt(perPct)} a year.`,
      rationale: "Checking accounts often pay little or no interest compared with savings or money-market accounts.",
      calculation: `Checking ${fmt(checking)} − 1.5 × average monthly spending ${fmt(monthlySpend)} = ${fmt(excess)}; ${fmt(excess)} × 1% = ${fmt(perPct)}/yr.`,
      assumptions: ["VELTRIX doesn't have live savings-rate data; compare current offers yourself.", "Keep enough in checking for upcoming bills."],
      action: "Review accounts",
      actionHref: "/app/overview",
      estimateType: "POTENTIAL",
      estimateCents: perPct,
      evidence: { rows: [{ label: "Checking balance", value: fmt(checking) }, { label: "Average monthly spending", value: fmt(monthlySpend) }], savingsParts: [{ key: "idle_cash", cents: perPct }] },
      priority: 35,
      links: accounts.filter((a) => a.type === "CHECKING").slice(0, 2).map((a) => ({ type: "account" as const, id: a.id, name: a.name, href: "/app/overview" })),
      confidence: "low",
      confidenceBasis: "No live savings-rate data; the figure is per 1% of interest.",
    });
  }

  // 7. Trips projected over budget
  for (const t of trips.filter((x) => x.budgetCents !== null && x.status !== "CANCELLED" && x.status !== "COMPLETED")) {
    if (t.projectedCents > (t.budgetCents ?? 0)) {
      out.push({
        kind: "trip",
        dedupeKey: `trip:${t.id}:${t.projectedCents}`,
        title: `${t.name} is projected ${fmt(t.projectedCents - t.budgetCents!)} over budget`,
        summary: `Spent ${fmt(t.spentCents)} plus ${fmt(t.quotedCents)} in saved quotes against a ${fmt(t.budgetCents!)} budget.`,
        rationale: "Saved quotes show what the trip will cost if you book them.",
        calculation: `${fmt(t.spentCents)} spent + ${fmt(t.quotedCents)} quoted = ${fmt(t.projectedCents)}.`,
        assumptions: ["Quotes are prices observed at a point in time and may change.", "Expenses in other currencies are not included."],
        action: "Open trip",
        actionHref: "/app/travel",
        estimateType: "NONE",
        priority: 50,
        links: [{ type: "trip", id: t.id, name: t.name, href: "/app/travel" }],
        confidence: "medium",
        confidenceBasis: "Uses quotes you saved, which can change.",
        eventDate: t.startDate,
      });
    }
  }

  // 8. Savings rate snapshot
  const cf = monthlyCashflow(last3);
  const rates = cf.map((m) => m.savingsRate).filter((r): r is number => r !== null);
  if (rates.length === 3) {
    const avgRate = rates.reduce((a, b) => a + b, 0) / 3;
    if (avgRate < 10) {
      out.push({
        kind: "savings_rate",
        dedupeKey: `savingsrate:${ym}`,
        title: `You kept ${avgRate.toFixed(0)}% of income over the last 3 months`,
        summary: "A higher savings rate speeds up every goal. Small recurring cuts compound over a year.",
        rationale: "Savings rate is income minus spending, as a share of income.",
        calculation: cf.map((m) => `${m.month}: ${m.savingsRate?.toFixed(1)}%`).join("; "),
        assumptions: ["Only income and spending recorded in VELTRIX are included."],
        action: "Try spending less in the What-if Lab",
        actionHref: "/app/plan?tab=whatif&preset=cut",
        estimateType: "NONE",
        priority: 30,
        links: [],
        confidence: "high",
        confidenceBasis: "Calculated from 3 full months of income and spending.",
      });
    }
  }
  return consolidate(out);
}

/**
 * One opportunity per underlying event: a price increase on a charge that already has a
 * renewal card is folded into that card, and the subscription review is dropped when
 * renewal cards already cover every subscription in it.
 */
export function consolidate(drafts: InsightDraft[]): InsightDraft[] {
  const recurringIdsOf = (d: InsightDraft) => d.links.filter((l) => l.type === "recurring").map((l) => l.id);
  const renewals = drafts.filter((d) => d.kind === "renewal_over_budget");
  const renewalByRec = new Map(renewals.flatMap((d) => recurringIdsOf(d).map((id) => [id, d] as const)));
  const out: InsightDraft[] = [];
  for (const d of drafts) {
    if (d.kind === "bill_increase") {
      const target = recurringIdsOf(d).map((id) => renewalByRec.get(id)).find(Boolean);
      if (target) {
        target.summary += ` It also went up recently: ${d.summary.charAt(0).toLowerCase()}${d.summary.slice(1)}`;
        target.calculation += ` Price change: ${d.calculation}`;
        target.title = `${target.title} (and just went up)`;
        continue;
      }
    }
    if (d.kind === "subscriptions") {
      const ids = (d.evidence?.savingsParts ?? []).map((p) => p.key.replace(/^rec:/, ""));
      if (ids.length && ids.every((id) => renewalByRec.has(id))) continue;
    }
    out.push(d);
  }
  return out;
}

export interface RankedDraft extends InsightDraft {
  score: number;
  scoreBasis: ReturnType<typeof rankOpportunity>;
}

/** Rank drafts using recent dismissals per kind (no other behavioral data). */
export async function rankDrafts(userId: string, drafts: InsightDraft[], today: string): Promise<RankedDraft[]> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const dismissals = await db.financialInsight.groupBy({ by: ["kind"], where: { userId, status: "DISMISSED", outcomeAt: { gte: since } }, _count: { _all: true } });
  const counts = new Map(dismissals.map((d) => [d.kind, d._count._all]));
  return drafts
    .map((d) => {
      const basis = rankOpportunity({
        priority: d.priority,
        impactCents: d.estimateCents ?? null,
        impactType: d.estimateType,
        daysUntil: d.eventDate && d.eventDate >= today ? daysBetween(today, d.eventDate) : null,
        confidence: d.confidence,
        recentDismissalsOfKind: counts.get(d.kind) ?? 0,
      });
      return { ...d, score: basis.score, scoreBasis: basis };
    })
    .sort((a, b) => b.score - a.score);
}

/** Recompute and persist opportunities. User decisions survive; stale ones are retired as RESOLVED. */
export async function refreshInsights(userId: string, timezone = "UTC", currency = "USD") {
  const today = todayIn(timezone);
  const drafts = await rankDrafts(userId, await computeInsights(userId, timezone, currency), today);
  const keys = drafts.map((d) => d.dedupeKey);
  for (const d of drafts) {
    const fields = {
      title: d.title,
      summary: d.summary,
      rationale: d.rationale,
      calculation: d.calculation,
      assumptions: d.assumptions,
      action: d.action,
      actionHref: d.actionHref,
      estimateAmount: d.estimateCents != null ? dec(d.estimateCents) : null,
      estimateType: d.estimateType,
      evidence: (d.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
      priority: d.priority,
      links: d.links as unknown as Prisma.InputJsonValue,
      confidence: d.confidence,
      confidenceBasis: d.confidenceBasis,
      eventDate: d.eventDate ? fromYmd(d.eventDate) : null,
      score: d.score,
      scoreBasis: d.scoreBasis as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
    };
    await db.financialInsight.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: d.dedupeKey } },
      create: { userId, kind: d.kind, dedupeKey: d.dedupeKey, ...fields },
      update: fields,
    });
  }
  // A condition that holds again reopens; one that no longer holds is resolved.
  await db.financialInsight.updateMany({ where: { userId, status: "RESOLVED", dedupeKey: { in: keys } }, data: { status: "ACTIVE" } });
  await db.financialInsight.updateMany({ where: { userId, status: { in: ["ACTIVE", "FOLLOWING"] }, dedupeKey: { notIn: keys } }, data: { status: "RESOLVED", outcomeAt: new Date() } });
  const pref = await db.userPreference.findUnique({ where: { userId }, select: { mutedInsightKinds: true } });
  const muted = new Set(pref?.mutedInsightKinds ?? []);
  for (const d of drafts.filter((x) => ["budget", "goal", "renewal_over_budget", "commitments_vs_cash", "bill_increase"].includes(x.kind) && !muted.has(x.kind))) {
    await notify(userId, { kind: d.kind, dedupeKey: `insight:${d.dedupeKey}`, title: d.title, body: d.summary, link: "/app/opportunities" });
  }
}

type Row = Awaited<ReturnType<typeof db.financialInsight.findFirstOrThrow>>;
function serialize(r: Row) {
  const evidence = r.evidence as { rows?: EvidenceRow[]; savingsParts?: { key: string; cents: number }[] } | unknown[] | null;
  return {
    id: r.id,
    kind: r.kind,
    kindLabel: OPPORTUNITY_KINDS[r.kind] ?? r.kind,
    title: r.title,
    summary: r.summary,
    rationale: r.rationale,
    calculation: r.calculation,
    assumptions: r.assumptions,
    action: r.action,
    actionHref: r.actionHref,
    estimateCents: r.estimateAmount ? cents(r.estimateAmount) : null,
    estimateType: r.estimateType,
    evidence: Array.isArray(evidence) ? [] : (evidence?.rows ?? []),
    savingsParts: Array.isArray(evidence) ? [] : (evidence?.savingsParts ?? []),
    links: (r.links as OpportunityLink[] | null) ?? [],
    confidence: r.confidence as OpportunityConfidence,
    confidenceBasis: r.confidenceBasis,
    eventDate: r.eventDate ? r.eventDate.toISOString().slice(0, 10) : null,
    score: r.score,
    scoreBasis: r.scoreBasis as ReturnType<typeof rankOpportunity> | null,
    status: r.status,
    outcome: r.outcome,
    outcomeAt: r.outcomeAt?.toISOString() ?? null,
    firstSeenAt: r.firstSeenAt.toISOString(),
    generatedAt: r.generatedAt.toISOString(),
  };
}
export type SerializedInsight = ReturnType<typeof serialize>;

async function mutedKinds(userId: string) {
  const pref = await db.userPreference.findUnique({ where: { userId }, select: { mutedInsightKinds: true } });
  return pref?.mutedInsightKinds ?? [];
}

/** Open and followed opportunities, followed first, then by score. Muted kinds are hidden. */
export async function listInsights(userId: string, limit = 20) {
  const muted = await mutedKinds(userId);
  const rows = await db.financialInsight.findMany({
    where: { userId, status: { in: ["ACTIVE", "FOLLOWING"] }, kind: { notIn: muted } },
    orderBy: [{ score: "desc" }, { priority: "desc" }, { generatedAt: "desc" }],
    take: limit,
  });
  return rows.map(serialize).sort((a, b) => Number(b.status === "FOLLOWING") - Number(a.status === "FOLLOWING"));
}

export async function opportunityOverview(userId: string) {
  const muted = await mutedKinds(userId);
  const [open, history] = await Promise.all([
    listInsights(userId, 50),
    db.financialInsight.findMany({ where: { userId, status: { in: ["DONE", "DISMISSED", "RESOLVED"] }, generatedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, orderBy: [{ outcomeAt: "desc" }, { generatedAt: "desc" }], take: 30 }),
  ]);
  return {
    open,
    history: history.map(serialize),
    muted: muted.map((k) => ({ kind: k, label: OPPORTUNITY_KINDS[k] ?? k })),
    kinds: Object.entries(OPPORTUNITY_KINDS).map(([kind, label]) => ({ kind, label })),
    // Possible savings across open items, each underlying record counted once.
    potentialSavingsCents: totalPotentialSavings(open.filter((o) => o.estimateType === "POTENTIAL" || o.savingsParts.length)),
    lastRefreshedAt: open.reduce<string | null>((m, o) => (m && m > o.generatedAt ? m : o.generatedAt), null),
  };
}

export const OUTCOMES = ["acted", "already_handled", "not_relevant", "not_accurate"] as const;

export async function setInsightStatus(userId: string, id: string, status: "DISMISSED" | "DONE" | "ACTIVE" | "FOLLOWING", outcome?: (typeof OUTCOMES)[number] | null) {
  const i = await db.financialInsight.findFirst({ where: { id, userId } });
  if (!i) throw notFound("Opportunity");
  const closing = status === "DISMISSED" || status === "DONE";
  return db.financialInsight.update({
    where: { id },
    data: { status, outcome: closing ? (outcome ?? (status === "DONE" ? "acted" : null)) : null, outcomeAt: closing ? new Date() : null },
  });
}

export async function setKindMuted(userId: string, kind: string, muted: boolean) {
  if (!(kind in OPPORTUNITY_KINDS)) throw notFound("Opportunity type");
  const current = new Set(await mutedKinds(userId));
  if (muted) current.add(kind);
  else current.delete(kind);
  await db.userPreference.upsert({ where: { userId }, create: { userId, mutedInsightKinds: [...current] }, update: { mutedInsightKinds: [...current] } });
  return [...current];
}
