/**
 * Personal Opportunity Map: where a user could make meaningful progress, by area.
 * Each area states its current position from the user's data, a possible impact only when one can
 * be calculated (labelled as such, never promised), effort, confidence with its basis, time to
 * benefit, what's missing, and one concrete next step. Unknown is reported as unknown.
 */
import type { Cents } from "../money";
import { formatMoney } from "../money";

export const MAP_AREAS = [
  { id: "cash_flow", title: "Improve monthly cash flow" },
  { id: "emergency_reserve", title: "Build an emergency reserve" },
  { id: "borrowing_costs", title: "Reduce borrowing costs" },
  { id: "income", title: "Increase income" },
  { id: "major_purchase", title: "Prepare for a major purchase" },
  { id: "better_value", title: "Find better-value products" },
  { id: "travel", title: "Make travel more affordable" },
  { id: "investing", title: "Develop a long-term investing plan" },
  { id: "records", title: "Organize financial records" },
  { id: "complexity", title: "Reduce unnecessary complexity" },
] as const;
export type MapAreaId = (typeof MAP_AREAS)[number]["id"];
export const MAP_AREA_IDS = MAP_AREAS.map((a) => a.id) as MapAreaId[];

/** Which opportunity kinds belong to which area. */
export const KIND_AREA: Record<string, MapAreaId> = {
  subscriptions: "cash_flow",
  bill_increase: "cash_flow",
  renewal_over_budget: "cash_flow",
  spending_spike: "cash_flow",
  budget: "cash_flow",
  savings_rate: "cash_flow",
  commitments_vs_cash: "cash_flow",
  one_time: "cash_flow",
  emergency_fund: "emergency_reserve",
  goal: "major_purchase",
  price: "better_value",
  trip: "travel",
  trip_vs_goal: "travel",
  research_holding: "investing",
  idle_cash: "investing",
};

export interface MapInput {
  currency: string;
  hasAccounts: boolean;
  incomeCents: Cents | null;
  essentialCents: Cents | null;
  discretionaryCents: Cents | null;
  surplusCents: Cents | null;
  liquidCents: Cents | null;
  emergencyTargetMonths: number;
  debts: { name: string; balanceCents: Cents; aprPercent: number | null }[];
  recurring: { count: number; monthlyCents: Cents; duplicateMerchants: string[] };
  /** Purchase-type goals only (an emergency fund belongs to the reserve area). */
  goals: { name: string; targetCents: Cents; savedCents: Cents; monthlyCents: Cents; targetMonth: number | null }[];
  products: { active: number; withTarget: number; atOrBelowTarget: number };
  trips: { upcoming: number; overBudget: { name: string; overCents: Cents }[]; withoutBudget: number };
  investments: { cents: Cents | null; holdings: number };
  records: { transactions: number; uncategorized: number; staleAccounts: number; monthsOfHistory: number; issues: number };
  accounts: number;
  /** Open opportunities per area: count and possible yearly savings (each record counted once). */
  opportunities: Partial<Record<MapAreaId, { count: number; potentialAnnualCents: Cents }>>;
}

export type AreaStatus = "focus" | "room" | "strong" | "unknown";
export interface MapArea {
  id: MapAreaId;
  title: string;
  status: AreaStatus;
  /** Where things stand, in one sentence, from the user's data. */
  position: string;
  impact: { cents: Cents | null; label: string; kind: "possible_savings" | "at_stake" | "gap" | "none"; basis: string };
  effort: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  confidenceBasis: string;
  timeToBenefit: string;
  dependencies: string[];
  nextStep: { label: string; href: string };
  opportunities: number;
}

const STATUS_RANK: Record<AreaStatus, number> = { focus: 0, room: 1, unknown: 2, strong: 3 };

export function buildOpportunityMap(i: MapInput, prefs: { focus: MapAreaId[]; hidden: MapAreaId[] } = { focus: [], hidden: [] }): { areas: MapArea[]; hidden: MapArea[] } {
  const m = (c: Cents) => formatMoney(c, i.currency);
  const opp = (id: MapAreaId) => i.opportunities[id] ?? { count: 0, potentialAnnualCents: 0 };
  const spendKnown = i.essentialCents !== null;
  const historyConfidence = (): MapArea["confidence"] => (i.records.monthsOfHistory >= 3 ? "high" : i.records.monthsOfHistory >= 1 ? "medium" : "low");
  const historyBasis = i.records.monthsOfHistory ? `${i.records.monthsOfHistory} month${i.records.monthsOfHistory === 1 ? "" : "s"} of transactions` : "No transaction history yet; based on what you entered";
  const areas: MapArea[] = [];

  // 1. Cash flow
  {
    const o = opp("cash_flow");
    const s = i.surplusCents;
    areas.push({
      id: "cash_flow",
      title: "Improve monthly cash flow",
      status: s === null ? "unknown" : s < 0 ? "focus" : i.incomeCents && s < i.incomeCents * 0.1 ? "room" : o.potentialAnnualCents > 0 ? "room" : "strong",
      position: s === null ? "VELTRIX doesn't know your income and spending yet." : s < 0 ? `You spend about ${m(-s)} a month more than you earn.` : `About ${m(s)} a month is left after spending and debt payments.`,
      impact: o.potentialAnnualCents > 0 ? { cents: o.potentialAnnualCents, label: "Possible savings per year", kind: "possible_savings", basis: `From ${o.count} open opportunit${o.count === 1 ? "y" : "ies"} (recurring charges, price increases, budgets), each charge counted once. Not confirmed until it happens.` } : { cents: null, label: "No savings identified yet", kind: "none", basis: "No open opportunities with a calculable saving." },
      effort: "low",
      confidence: s === null ? "low" : historyConfidence(),
      confidenceBasis: historyBasis,
      timeToBenefit: "From your next billing cycle",
      dependencies: [...(i.incomeCents === null ? ["Your income"] : []), ...(!spendKnown ? ["Spending history or a monthly budget"] : [])],
      nextStep: s === null ? { label: "Finish guided setup", href: "/app/setup" } : o.potentialAnnualCents > 0 ? { label: "Review bills & subscriptions", href: "/app/bills" } : { label: "See where your money goes", href: "/app/budgets" },
      opportunities: o.count,
    });
  }

  // 2. Emergency reserve
  {
    const target = i.essentialCents !== null ? i.essentialCents * i.emergencyTargetMonths : null;
    const months = i.essentialCents && i.liquidCents !== null ? i.liquidCents / i.essentialCents : null;
    const gap = target !== null && i.liquidCents !== null ? Math.max(0, target - i.liquidCents) : null;
    const monthsToGoal = gap && i.surplusCents && i.surplusCents > 0 ? Math.ceil(gap / i.surplusCents) : null;
    areas.push({
      id: "emergency_reserve",
      title: "Build an emergency reserve",
      status: months === null ? "unknown" : months < 1 ? "focus" : gap ? "room" : "strong",
      position: months === null ? "Needs your cash balances and essential spending." : `Your cash covers ${months.toFixed(1)} months of essentials; your target is ${i.emergencyTargetMonths}.`,
      impact: gap ? { cents: gap, label: "Still to save", kind: "gap", basis: `${i.emergencyTargetMonths} months × ${m(i.essentialCents!)} essentials − ${m(i.liquidCents!)} in cash and savings` } : { cents: null, label: gap === 0 ? "Target reached" : "Unknown", kind: "none", basis: gap === 0 ? "Cash already covers your target." : "Missing balances or spending." },
      effort: "medium",
      confidence: months === null ? "low" : historyConfidence(),
      confidenceBasis: historyBasis,
      timeToBenefit: !gap ? "Already there" : monthsToGoal ? `About ${monthsToGoal} month${monthsToGoal === 1 ? "" : "s"} if your whole surplus went to it` : "Depends on freeing up monthly cash first",
      dependencies: [...(i.liquidCents === null ? ["Cash account balances"] : []), ...(!spendKnown ? ["Essential spending"] : [])],
      nextStep: !gap ? { label: "Adjust your reserve target", href: "/app/plan?tab=assumptions" } : { label: "Set up a reserve goal", href: "/app/goals" },
      opportunities: opp("emergency_reserve").count,
    });
  }

  // 3. Borrowing costs
  {
    const known = i.debts.filter((d) => d.aprPercent !== null);
    const missing = i.debts.filter((d) => d.aprPercent === null);
    const interest = Math.round(known.reduce((s, d) => s + (d.balanceCents * (d.aprPercent ?? 0)) / 100, 0));
    const highest = [...known].sort((a, b) => (b.aprPercent ?? 0) - (a.aprPercent ?? 0))[0];
    areas.push({
      id: "borrowing_costs",
      title: "Reduce borrowing costs",
      status: !i.hasAccounts ? "unknown" : !i.debts.length ? "strong" : missing.length === i.debts.length ? "unknown" : known.some((d) => (d.aprPercent ?? 0) >= 15) ? "focus" : "room",
      position: !i.hasAccounts ? "No accounts recorded yet." : !i.debts.length ? "No debts recorded." : `${i.debts.length} debt${i.debts.length === 1 ? "" : "s"} totaling ${m(i.debts.reduce((s, d) => s + d.balanceCents, 0))}${highest ? `; the highest rate is ${highest.aprPercent}% (${highest.name})` : ""}.`,
      impact: interest > 0 ? { cents: interest, label: "Interest per year at today's balances", kind: "at_stake", basis: `Balance × APR for ${known.map((d) => d.name).join(", ")}. Paying down the highest rate first reduces this the fastest.` } : { cents: null, label: i.debts.length ? "Unknown until rates are entered" : "Nothing to reduce", kind: "none", basis: missing.length ? `Missing interest rates for ${missing.map((d) => d.name).join(", ")}.` : "No interest-bearing debt recorded." },
      effort: "medium",
      confidence: !i.debts.length ? "high" : missing.length ? "low" : "high",
      confidenceBasis: missing.length ? "Some interest rates aren't entered" : "Uses the balances and rates you entered",
      timeToBenefit: "Starts with your next payment",
      dependencies: missing.map((d) => `Interest rate for ${d.name}`),
      nextStep: missing.length ? { label: "Add interest rates", href: "/app/plan?tab=assumptions" } : i.debts.length ? { label: "Model extra payments", href: "/app/plan" } : { label: "Add a loan or card", href: "/app/overview" },
      opportunities: 0,
    });
  }

  // 4. Income
  areas.push({
    id: "income",
    title: "Increase income",
    status: i.incomeCents === null ? "unknown" : "room",
    position: i.incomeCents === null ? "Your income isn't recorded." : `Recorded income: about ${m(i.incomeCents)} a month.`,
    impact: { cents: null, label: "Not estimated", kind: "none", basis: "VELTRIX has no job, salary or market-pay sources yet, so it won't guess what you could earn." },
    effort: "high",
    confidence: "low",
    confidenceBasis: "No external pay data",
    timeToBenefit: "Months",
    dependencies: ["Job and salary data sources (not available yet)", ...(i.incomeCents === null ? ["Your income"] : [])],
    nextStep: { label: "See what a raise would change", href: "/app/plan" },
    opportunities: 0,
  });

  // 5. Major purchase
  {
    const open = i.goals.filter((g) => g.savedCents < g.targetCents);
    const offTrack = open.filter((g) => g.targetMonth !== null && (g.monthlyCents <= 0 || Math.ceil((g.targetCents - g.savedCents) / g.monthlyCents) > g.targetMonth));
    const dated = open.filter((g) => g.targetMonth !== null);
    const undated = open.filter((g) => g.targetMonth === null);
    const shortfall = offTrack.reduce((s, g) => s + Math.max(0, g.targetCents - g.savedCents - g.monthlyCents * (g.targetMonth ?? 0)), 0);
    areas.push({
      id: "major_purchase",
      title: "Prepare for a major purchase",
      status: !open.length ? (i.goals.length ? "strong" : "unknown") : offTrack.length ? "focus" : "room",
      position: !i.goals.length
        ? "No savings goals yet."
        : !open.length
          ? "All your goals are funded."
          : `${open.length} goal${open.length === 1 ? "" : "s"} in progress${offTrack.length ? `; ${offTrack.map((g) => g.name).join(", ")} won't make ${offTrack.length === 1 ? "its" : "their"} date at the current pace` : dated.length ? `; ${dated.length === open.length ? "all" : `${dated.length} dated`} on pace` : ""}${undated.length ? `; ${undated.length} without a target date` : ""}.`,
      impact:
        shortfall > 0
          ? { cents: shortfall, label: "Short by the target date", kind: "gap", basis: "Target − saved − planned monthly × months left, for goals behind pace" }
          : { cents: null, label: dated.length ? "On pace" : "No target dates", kind: "none", basis: dated.length ? "Planned contributions reach each dated goal in time." : "Add a target date to see whether you're on pace." },
      effort: "medium",
      confidence: open.some((g) => g.monthlyCents <= 0) ? "medium" : "high",
      confidenceBasis: "Uses your goal targets, savings and planned monthly amounts",
      timeToBenefit: "Each month you contribute",
      dependencies: [...open.filter((g) => g.monthlyCents <= 0).map((g) => `A monthly amount for "${g.name}"`), ...undated.map((g) => `A target date for "${g.name}"`)],
      nextStep: !i.goals.length ? { label: "Create a goal", href: "/app/goals" } : { label: "Check a purchase against your plan", href: "/app/plan?tab=decide" },
      opportunities: opp("major_purchase").count,
    });
  }

  // 6. Better-value products
  areas.push({
    id: "better_value",
    title: "Find better-value products",
    status: !i.products.active ? "unknown" : i.products.atOrBelowTarget ? "focus" : "room",
    position: !i.products.active ? "No products saved yet." : `${i.products.active} saved product${i.products.active === 1 ? "" : "s"}; ${i.products.atOrBelowTarget} at or below your target price${i.products.withTarget < i.products.active ? `, ${i.products.active - i.products.withTarget} without a target` : ""}.`,
    impact: { cents: null, label: "Not estimated", kind: "none", basis: "Only prices you record are compared. VELTRIX doesn't have merchant price feeds, so it can't promise a better price exists." },
    effort: "low",
    confidence: "medium",
    confidenceBasis: "Prices you or the extension recorded",
    timeToBenefit: "When you buy",
    dependencies: ["Merchant price feeds (not configured)", ...(i.products.active > i.products.withTarget ? ["Target prices for your saved products"] : [])],
    nextStep: i.products.active ? { label: "Review saved products", href: "/app/shopping" } : { label: "Save a product with the extension", href: "/app/settings#extension" },
    opportunities: opp("better_value").count,
  });

  // 7. Travel
  {
    const over = i.trips.overBudget.reduce((s, t) => s + t.overCents, 0);
    areas.push({
      id: "travel",
      title: "Make travel more affordable",
      status: !i.trips.upcoming ? "unknown" : over > 0 ? "focus" : i.trips.withoutBudget ? "room" : "strong",
      position: !i.trips.upcoming ? "No upcoming trips." : over > 0 ? `${i.trips.overBudget.map((t) => t.name).join(", ")} ${i.trips.overBudget.length === 1 ? "is" : "are"} over budget by ${m(over)}.` : `${i.trips.upcoming} upcoming trip${i.trips.upcoming === 1 ? "" : "s"}${i.trips.withoutBudget ? `, ${i.trips.withoutBudget} without a budget` : ", within budget"}.`,
      impact: over > 0 ? { cents: over, label: "Over trip budgets", kind: "gap", basis: "Booked and planned costs minus each trip's budget (quotes excluded)" } : { cents: null, label: "Not estimated", kind: "none", basis: "No travel price feeds; only costs you enter are compared." },
      effort: "medium",
      confidence: "medium",
      confidenceBasis: "Costs you entered",
      timeToBenefit: "Before you book",
      dependencies: ["Travel price feeds (not configured)", ...(i.trips.withoutBudget ? ["A budget for each trip"] : [])],
      nextStep: { label: i.trips.upcoming ? "Review trip budgets" : "Plan a trip", href: "/app/travel" },
      opportunities: opp("travel").count,
    });
  }

  // 8. Investing plan
  {
    const reserveMet = i.essentialCents && i.liquidCents !== null ? i.liquidCents >= i.essentialCents * i.emergencyTargetMonths : false;
    areas.push({
      id: "investing",
      title: "Develop a long-term investing plan",
      status: i.investments.cents === null ? (reserveMet ? "room" : "unknown") : "room",
      position: i.investments.cents === null ? "No investment or retirement accounts recorded." : `${m(i.investments.cents)} invested across ${i.investments.holdings} holding${i.investments.holdings === 1 ? "" : "s"}.`,
      impact: { cents: null, label: "Not estimated", kind: "none", basis: "Returns aren't guaranteed. The What-if Lab projects ranges from the return you choose." },
      effort: "medium",
      confidence: "medium",
      confidenceBasis: "Projections depend on an assumed return",
      timeToBenefit: "Years",
      dependencies: reserveMet ? [] : ["An emergency reserve first is usually safer"],
      nextStep: { label: "Project long-term saving", href: "/app/plan" },
      opportunities: opp("investing").count,
    });
  }

  // 9. Records
  {
    const r = i.records;
    const problems = r.uncategorized + r.staleAccounts + r.issues;
    areas.push({
      id: "records",
      title: "Organize financial records",
      status: !r.transactions && !i.hasAccounts ? "unknown" : !r.transactions ? "room" : problems === 0 ? "strong" : r.uncategorized > r.transactions * 0.2 || r.staleAccounts ? "focus" : "room",
      position: [r.uncategorized ? `${r.uncategorized} uncategorized transaction${r.uncategorized === 1 ? "" : "s"}` : null, r.staleAccounts ? `${r.staleAccounts} account${r.staleAccounts === 1 ? "" : "s"} not updated recently` : null, r.issues ? `${r.issues} missing detail${r.issues === 1 ? "" : "s"} in your financial profile` : null].filter(Boolean).join("; ") || (r.transactions ? "Your records are in order." : i.hasAccounts ? "No transactions recorded yet. Connecting a bank or importing a CSV makes every estimate here more reliable." : "No records yet."),
      impact: { cents: null, label: "Better accuracy", kind: "none", basis: "Every other estimate on this map gets more reliable." },
      effort: "low",
      confidence: "high",
      confidenceBasis: "Counted directly from your records",
      timeToBenefit: "Immediately",
      dependencies: [],
      nextStep: !r.transactions ? { label: "Add or import transactions", href: "/app/transactions" } : r.uncategorized ? { label: "Categorize transactions", href: "/app/transactions" } : r.issues ? { label: "Fill in missing details", href: "/app/plan" } : { label: "Review accounts", href: "/app/overview" },
      opportunities: 0,
    });
  }

  // 10. Complexity
  {
    const dup = i.recurring.duplicateMerchants;
    areas.push({
      id: "complexity",
      title: "Reduce unnecessary complexity",
      status: !i.accounts && !i.recurring.count ? "unknown" : dup.length ? "focus" : i.recurring.count > 10 || i.accounts > 8 ? "room" : "strong",
      position: `${i.accounts} account${i.accounts === 1 ? "" : "s"} and ${i.recurring.count} recurring charge${i.recurring.count === 1 ? "" : "s"} (${m(i.recurring.monthlyCents)}/mo)${dup.length ? `; more than one recurring charge from ${dup.join(", ")}` : ""}.`,
      impact: { cents: null, label: "Fewer things to track", kind: "none", basis: dup.length ? "Charges from the same merchant may be duplicates, or may be separate services. Check before cancelling." : "No duplicate-looking charges found." },
      effort: "low",
      confidence: "medium",
      confidenceBasis: "Based on detected recurring charges",
      timeToBenefit: "From your next billing cycle",
      dependencies: [],
      nextStep: { label: "Review recurring charges", href: "/app/bills" },
      opportunities: 0,
    });
  }

  const focusRank = (id: MapAreaId) => {
    const k = prefs.focus.indexOf(id);
    return k === -1 ? 99 : k;
  };
  const hidden = new Set(prefs.hidden.filter((h) => !prefs.focus.includes(h)));
  const sorted = areas.sort((a, b) => focusRank(a.id) - focusRank(b.id) || STATUS_RANK[a.status] - STATUS_RANK[b.status] || (b.impact.cents ?? 0) - (a.impact.cents ?? 0));
  return { areas: sorted.filter((a) => !hidden.has(a.id)), hidden: sorted.filter((a) => hidden.has(a.id)) };
}
