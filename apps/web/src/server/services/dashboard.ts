import { CHART_GROUPS, chartGroupFor, monthlyCashflow, percentChange, spendingBreakdown, SYSTEM_CATEGORIES, totalIncome, totalSpending } from "@veltrix/shared";
import { addDays, addMonths, fromYmd, monthStart, todayIn } from "../dates";
import { db } from "../db";
import { cents } from "../money";
import { netWorthHistory, netWorthNow, listAccounts } from "./accounts";
import { txnsForRange } from "./transactions";

export type SpendingRange = "month" | "3m" | "12m";

export function rangeBounds(range: SpendingRange, today: string) {
  const ym = today.slice(0, 7);
  const tomorrow = addDays(today, 1);
  if (range === "month") return { from: monthStart(ym), to: tomorrow, prevFrom: monthStart(addMonths(ym, -1)), prevTo: addDays(monthStart(addMonths(ym, -1)), Number(today.slice(8, 10))), label: "This month" };
  const months = range === "3m" ? 3 : 12;
  const from = monthStart(addMonths(ym, -months));
  const to = monthStart(ym);
  return { from, to, prevFrom: monthStart(addMonths(ym, -months * 2)), prevTo: from, label: range === "3m" ? "Previous 3 months" : "Previous 12 months" };
}

const GROUP_NAMES: Record<string, string> = Object.fromEntries(SYSTEM_CATEGORIES.map((c) => [c.slug, c.name]));

export async function spendingOverview(userId: string, range: SpendingRange, timezone = "UTC", currency = "USD") {
  const today = todayIn(timezone);
  const b = rangeBounds(range, today);
  const [cur, prev] = await Promise.all([txnsForRange(userId, b.from, b.to, currency), txnsForRange(userId, b.prevFrom, b.prevTo, currency)]);
  const curB = spendingBreakdown(cur);
  const prevB = spendingBreakdown(prev);
  const prevMap = new Map(prevB.slices.map((s) => [s.group, s.totalCents]));
  const topByGroup = new Map<string, { merchant: string; cents: number }[]>();
  for (const g of CHART_GROUPS) {
    const m = new Map<string, number>();
    for (const t of cur) if (t.amountCents < 0 && t.categoryKind !== "TRANSFER" && chartGroupFor(t.categorySlug) === g) m.set(t.merchant, (m.get(t.merchant) ?? 0) - t.amountCents);
    topByGroup.set(g, [...m.entries()].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([merchant, c]) => ({ merchant, cents: c })));
  }
  return {
    range,
    label: b.label,
    from: b.from,
    toExclusive: b.to,
    currency,
    totalCents: curB.totalCents,
    previousTotalCents: prevB.totalCents,
    changePercent: percentChange(curB.totalCents, prevB.totalCents),
    comparisonLabel: range === "month" ? "vs. same period last month" : "vs. the period before",
    slices: curB.slices.map((s) => ({
      ...s,
      name: s.group === "other" ? "Other" : GROUP_NAMES[s.group] ?? s.group,
      previousCents: prevMap.get(s.group) ?? 0,
      topMerchants: topByGroup.get(s.group) ?? [],
    })),
    transactionCount: cur.length,
  };
}

/** Sum of the latest recorded balance on/before `date` for accounts of the given types; null if no history. */
async function balanceAt(userId: string, types: ("SAVINGS" | "INVESTMENT" | "RETIREMENT")[], date: string, currency: string) {
  const accounts = await db.connectedAccount.findMany({ where: { userId, type: { in: types }, archivedAt: null, currency }, select: { id: true } });
  if (!accounts.length) return null;
  let total = 0;
  let found = false;
  for (const a of accounts) {
    const b = await db.accountBalance.findFirst({ where: { accountId: a.id, asOf: { lte: fromYmd(date) } }, orderBy: { asOf: "desc" } });
    if (b) {
      total += cents(b.balance);
      found = true;
    }
  }
  return found ? total : null;
}

export async function dashboardSummary(userId: string, timezone = "UTC", baseCurrency = "USD") {
  const today = todayIn(timezone);
  const ym = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const prevMonthStart = monthStart(addMonths(ym, -1));
  const [nw, history, accounts, thisMonth, lastMonthSame] = await Promise.all([
    netWorthNow(userId, baseCurrency),
    netWorthHistory(userId, baseCurrency, addDays(today, -400)),
    listAccounts(userId),
    txnsForRange(userId, monthStart(ym), addDays(today, 1), baseCurrency),
    txnsForRange(userId, prevMonthStart, addDays(prevMonthStart, day), baseCurrency),
  ]);
  const monthAgo = addDays(today, -30);
  const pastPoint = [...history].reverse().find((p) => p.date <= monthAgo) ?? null;

  // Per-type balances 30 days ago, from the same history (carry-forward).
  const savingsNow = accounts.filter((a) => a.type === "SAVINGS" && a.currency === baseCurrency).reduce((s, a) => s + a.balanceCents, 0);
  const investNow = accounts.filter((a) => (a.type === "INVESTMENT" || a.type === "RETIREMENT") && a.currency === baseCurrency).reduce((s, a) => s + a.balanceCents, 0);

  const [savingsPast, investPast] = await Promise.all([
    balanceAt(userId, ["SAVINGS"], monthAgo, baseCurrency),
    balanceAt(userId, ["INVESTMENT", "RETIREMENT"], monthAgo, baseCurrency),
  ]);
  const spendNow = totalSpending(thisMonth);
  const spendPrev = totalSpending(lastMonthSame);
  return {
    today,
    netWorth: {
      cents: nw.netWorthCents,
      assetsCents: nw.assetsCents,
      liabilitiesCents: nw.liabilitiesCents,
      changeCents: pastPoint ? nw.netWorthCents - pastPoint.netWorthCents : null,
      changePercent: pastPoint ? percentChange(nw.netWorthCents, pastPoint.netWorthCents) : null,
      comparisonLabel: "vs. 30 days ago",
      excludedForeignCurrency: nw.excludedForeignCurrency,
      accountCount: nw.accountCount,
    },
    monthlySpending: {
      cents: spendNow,
      previousCents: spendPrev,
      changePercent: percentChange(spendNow, spendPrev),
      comparisonLabel: `vs. ${day} days last month`,
      incomeCents: totalIncome(thisMonth),
    },
    savings: {
      cents: savingsNow,
      changePercent: savingsPast !== null ? percentChange(savingsNow, savingsPast) : null,
      comparisonLabel: "vs. 30 days ago",
      accountCount: accounts.filter((a) => a.type === "SAVINGS").length,
    },
    investments: {
      cents: investNow,
      changePercent: investPast !== null ? percentChange(investNow, investPast) : null,
      // Account value change includes deposits; investment return is shown separately.
      comparisonLabel: "account value vs. 30 days ago",
      accountCount: accounts.filter((a) => a.type === "INVESTMENT" || a.type === "RETIREMENT").length,
    },
    history,
    cashflow: monthlyCashflow(thisMonth),
  };
}
