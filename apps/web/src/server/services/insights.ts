/**
 * Deterministic, explainable recommendations. Every insight states:
 *   what the opportunity is (title/summary), why it is relevant (rationale),
 *   how any estimate was calculated (calculation), what assumptions apply,
 *   and what the user can do (action). Potential savings are never shown as confirmed.
 */
import type { Prisma } from "@prisma/client";
import { formatMoney, monthlyCashflow, spendingBreakdown, spendingSpike } from "@veltrix/shared";
import { db } from "../db";
import { dec, cents } from "../money";
import { addDays, addMonths, monthStart, todayIn, daysInMonth } from "../dates";
import { notFound } from "../errors";
import { listAccounts } from "./accounts";
import { budgetStatusForMonth } from "./budgets";
import { listGoals } from "./goals";
import { listRecurring, refreshRecurring } from "./recurring";
import { listProducts } from "./shopping";
import { listTrips } from "./travel";
import { txnsForRange } from "./transactions";
import { notify } from "./notifications";

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
  estimateType: "CONFIRMED" | "POTENTIAL" | "NONE";
  evidence?: Prisma.InputJsonValue;
  priority: number;
}

const ESSENTIAL = new Set(["housing", "utilities", "food", "transport", "health"]);

export async function computeInsights(userId: string, timezone = "UTC", currency = "USD"): Promise<InsightDraft[]> {
  const today = todayIn(timezone);
  const ym = today.slice(0, 7);
  const out: InsightDraft[] = [];
  const fmt = (c: number) => formatMoney(c, currency);

  await refreshRecurring(userId, timezone);
  const [recurring, budgets, goals, accounts, products, trips, last3, thisMonth] = await Promise.all([
    listRecurring(userId),
    budgetStatusForMonth(userId, ym, timezone),
    listGoals(userId, timezone),
    listAccounts(userId),
    listProducts(userId),
    listTrips(userId),
    txnsForRange(userId, monthStart(addMonths(ym, -3)), monthStart(ym), currency),
    txnsForRange(userId, monthStart(ym), addDays(today, 1), currency),
  ]);

  // 1. Subscriptions worth reviewing
  const subs = recurring.filter((r) => r.status !== "DISMISSED" && r.currency === currency && ["subscriptions", "entertainment"].includes(r.category?.slug ?? "subscriptions"));
  if (subs.length) {
    const annual = subs.reduce((s, r) => s + r.estimatedAnnualCents, 0);
    const suspected = subs.filter((s) => s.status === "SUSPECTED").length;
    out.push({
      kind: "subscriptions",
      dedupeKey: `subscriptions:${ym}`,
      title: `Review ${subs.length} recurring subscription${subs.length > 1 ? "s" : ""}`,
      summary: `These charges add up to about ${fmt(annual)} a year. Cancelling any you no longer use is the simplest saving available.`,
      rationale: `VELTRIX found ${subs.length} charges that repeat on a regular schedule${suspected ? `; ${suspected} are inferred from your transactions and not yet confirmed by you` : ""}.`,
      calculation: subs
        .slice(0, 6)
        .map((s) => `${s.merchant}: ${fmt(s.amountCents)} × ${s.frequency.toLowerCase()} → ${fmt(s.estimatedAnnualCents)}/yr`)
        .join("; "),
      assumptions: ["Amounts and frequency are inferred from past charges and may change.", "The saving is only realised for subscriptions you actually cancel."],
      action: "Review subscriptions",
      actionHref: "/app/savings#subscriptions",
      estimateCents: annual,
      estimateType: "POTENTIAL",
      evidence: subs.slice(0, 6).map((s) => ({ merchant: s.merchant, amountCents: s.amountCents, frequency: s.frequency, status: s.status })),
      priority: 80,
    });
  }

  // 2. Budget categories near or over their limit
  for (const b of budgets) {
    for (const l of b.lines.filter((x) => x.health !== "ok")) {
      out.push({
        kind: "budget",
        dedupeKey: `budget:${l.lineId}:${ym}:${l.health}`,
        title: l.health === "over" ? `${l.category.name} is over budget` : `${l.category.name} is at ${Math.round(l.percentUsed)}% of its budget`,
        summary:
          l.health === "over"
            ? `You've spent ${fmt(l.spentCents)} against a ${fmt(l.limitCents)} limit this month.`
            : `${fmt(l.remainingCents)} remains for the rest of the month.`,
        rationale: `Your "${b.name}" budget warns at ${l.alertThreshold}% of each category's limit.`,
        calculation: `${fmt(l.spentCents)} spent ÷ ${fmt(l.limitCents)} limit = ${l.percentUsed.toFixed(1)}%.`,
        assumptions: ["Only transactions recorded in VELTRIX this month are counted.", "Transfers between your own accounts are excluded."],
        action: "Open budget",
        actionHref: "/app/budgets",
        estimateType: "NONE",
        priority: l.health === "over" ? 90 : 70,
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
      action: "Adjust goal",
      actionHref: "/app/goals",
      estimateType: "NONE",
      priority: 60,
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
        action: "Create an emergency fund goal",
        actionHref: "/app/goals?new=EMERGENCY_FUND",
        estimateType: "NONE",
        priority: 65,
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
        summary:
          spike.method === "pace"
            ? `At this pace you'll spend about ${fmt(spike.projectedCents)} this month, compared with a ${fmt(base)} monthly average.`
            : `You've already spent ${fmt(s.totalCents)} this month, compared with a ${fmt(base)} monthly average.`,
        rationale: "Catching a spending trend mid-month leaves time to adjust.",
        calculation:
          spike.method === "pace"
            ? `${fmt(s.totalCents)} across ${s.count} purchases in ${day} days, projected over ${dim} days = ${fmt(spike.projectedCents)}; average of the last 3 full months = ${fmt(base)}.`
            : `${fmt(s.totalCents)} spent so far this month (no projection); average of the last 3 full months = ${fmt(base)}.`,
        assumptions:
          spike.method === "pace"
            ? ["Assumes spending continues at the same daily pace.", "One large purchase can make the projection overstate the trend."]
            : ["Based only on money already spent; fixed bills like rent and utilities are never projected forward."],
        action: "See transactions",
        actionHref: `/app/transactions`,
        estimateType: "NONE",
        priority: 55,
      });
    }
  }

  // 6. Idle cash in checking
  const checking = accounts.filter((a) => a.type === "CHECKING" && a.currency === currency).reduce((s, a) => s + a.balanceCents, 0);
  const monthlySpend = Math.round(last3.filter((t) => t.amountCents < 0 && t.categoryKind !== "TRANSFER").reduce((s, t) => s - t.amountCents, 0) / 3);
  if (monthlySpend > 0 && checking > monthlySpend * 2) {
    const excess = checking - Math.round(monthlySpend * 1.5);
    out.push({
      kind: "idle_cash",
      dedupeKey: `idle:${ym}`,
      title: "Compare savings rates for cash sitting in checking",
      summary: `About ${fmt(excess)} in checking is above 1.5 months of typical spending. Each 1% of interest on that amount is roughly ${fmt(Math.round(excess * 0.01))} a year.`,
      rationale: "Checking accounts often pay little or no interest compared with savings or money-market accounts.",
      calculation: `Checking ${fmt(checking)} − 1.5 × average monthly spending ${fmt(monthlySpend)} = ${fmt(excess)}; ${fmt(excess)} × 1% = ${fmt(Math.round(excess * 0.01))}/yr.`,
      assumptions: ["VELTRIX doesn't have live savings-rate data; compare current offers yourself.", "Keep enough in checking for upcoming bills."],
      action: "Review accounts",
      actionHref: "/app/overview",
      estimateType: "POTENTIAL",
      estimateCents: Math.round(excess * 0.01),
      priority: 40,
    });
  }

  // 7. Saved products at a good recorded price
  for (const p of products.filter((x) => x.verdict?.tone === "positive" && x.status !== "PURCHASED")) {
    out.push({
      kind: "price",
      dedupeKey: `price:${p.id}:${p.latestPriceCents}`,
      title: `${p.title.slice(0, 50)}: ${p.verdict!.label.toLowerCase()}`,
      summary: `Last seen at ${fmt(p.latestPriceCents!)} at ${p.merchant}.`,
      rationale: "You saved this product to watch its price.",
      calculation: p.verdict!.basis,
      assumptions: ["Prices are those you recorded; other retailers may differ.", "Only buy if it still fits your budget and plans."],
      action: "View price history",
      actionHref: `/app/shopping?product=${p.id}`,
      estimateType: "NONE",
      priority: 45,
    });
  }

  // 8. Trips projected over budget
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
      });
    }
  }

  // 9. Savings rate snapshot (positive reinforcement or flag)
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
        action: "Open reports",
        actionHref: "/app/reports",
        estimateType: "NONE",
        priority: 35,
      });
    }
  }
  return out.sort((a, b) => b.priority - a.priority);
}

/** Recompute and persist insights. User dismissals survive; stale active insights are retired. */
export async function refreshInsights(userId: string, timezone = "UTC", currency = "USD") {
  const drafts = await computeInsights(userId, timezone, currency);
  const keys = drafts.map((d) => d.dedupeKey);
  for (const d of drafts) {
    await db.financialInsight.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: d.dedupeKey } },
      create: {
        userId,
        kind: d.kind,
        dedupeKey: d.dedupeKey,
        title: d.title,
        summary: d.summary,
        rationale: d.rationale,
        calculation: d.calculation,
        assumptions: d.assumptions,
        action: d.action,
        actionHref: d.actionHref,
        estimateAmount: d.estimateCents != null ? dec(d.estimateCents) : null,
        estimateType: d.estimateType,
        evidence: d.evidence,
        priority: d.priority,
      },
      update: {
        title: d.title,
        summary: d.summary,
        rationale: d.rationale,
        calculation: d.calculation,
        assumptions: d.assumptions,
        estimateAmount: d.estimateCents != null ? dec(d.estimateCents) : null,
        evidence: d.evidence,
        priority: d.priority,
        generatedAt: new Date(),
      },
    });
  }
  await db.financialInsight.updateMany({ where: { userId, status: "ACTIVE", dedupeKey: { notIn: keys } }, data: { status: "DONE" } });
  for (const d of drafts.filter((x) => x.kind === "budget" || x.kind === "goal")) {
    await notify(userId, { kind: d.kind, dedupeKey: `insight:${d.dedupeKey}`, title: d.title, body: d.summary, link: d.actionHref });
  }
}

export async function listInsights(userId: string, limit = 20) {
  const rows = await db.financialInsight.findMany({ where: { userId, status: "ACTIVE" }, orderBy: [{ priority: "desc" }, { generatedAt: "desc" }], take: limit });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    rationale: r.rationale,
    calculation: r.calculation,
    assumptions: r.assumptions,
    action: r.action,
    actionHref: r.actionHref,
    estimateCents: r.estimateAmount ? cents(r.estimateAmount) : null,
    estimateType: r.estimateType,
    generatedAt: r.generatedAt.toISOString(),
  }));
}
export type SerializedInsight = Awaited<ReturnType<typeof listInsights>>[number];

export async function setInsightStatus(userId: string, id: string, status: "DISMISSED" | "DONE" | "ACTIVE") {
  const i = await db.financialInsight.findFirst({ where: { id, userId } });
  if (!i) throw notFound("Insight");
  return db.financialInsight.update({ where: { id }, data: { status } });
}
