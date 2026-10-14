import { monthlyCashflow, spendingBreakdown, calculateNetWorth, type AccountType } from "@veltrix/shared";
import { db } from "../db";
import { addMonths, monthStart, todayIn, ymd } from "../dates";
import { cents } from "../money";
import { netWorthHistory } from "./accounts";
import { budgetStatusForMonth } from "./budgets";
import { txnsForRange } from "./transactions";
import { performance } from "./investments";

export async function buildReport(userId: string, period: "monthly" | "yearly", timezone = "UTC", currency = "USD") {
  const today = todayIn(timezone);
  const ym = today.slice(0, 7);
  const months = period === "monthly" ? 12 : 36;
  const from = monthStart(addMonths(ym, -(months - 1)));
  const txns = await txnsForRange(userId, from, monthStart(addMonths(ym, 1)), currency);
  const cf = monthlyCashflow(txns);
  // Fill gaps so months without data show as zero, not missing.
  const filled = Array.from({ length: months }, (_, i) => {
    const m = addMonths(ym, -(months - 1) + i);
    return cf.find((c) => c.month === m) ?? { month: m, incomeCents: 0, spendingCents: 0, netCents: 0, savingsRate: null };
  });
  const rows =
    period === "monthly"
      ? filled
      : Object.values(
          filled.reduce<Record<string, { month: string; incomeCents: number; spendingCents: number; netCents: number; savingsRate: number | null }>>((acc, m) => {
            const y = m.month.slice(0, 4);
            acc[y] ??= { month: y, incomeCents: 0, spendingCents: 0, netCents: 0, savingsRate: null };
            acc[y].incomeCents += m.incomeCents;
            acc[y].spendingCents += m.spendingCents;
            acc[y].netCents += m.netCents;
            acc[y].savingsRate = acc[y].incomeCents > 0 ? Math.round(((acc[y].incomeCents - acc[y].spendingCents) / acc[y].incomeCents) * 1000) / 10 : null;
            return acc;
          }, {}),
        );

  const accounts = await db.connectedAccount.findMany({ where: { userId, archivedAt: null } });
  const nw = calculateNetWorth(accounts.map((a) => ({ type: a.type as AccountType, balanceCents: cents(a.currentBalance), currency: a.currency })), currency);
  const debts = accounts
    .filter((a) => ["CREDIT_CARD", "LOAN", "MORTGAGE", "OTHER_LIABILITY"].includes(a.type))
    .map((a) => ({ name: a.name, type: a.type, balanceCents: cents(a.currentBalance), currency: a.currency }));

  const adherence = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(ym, -i);
    const statuses = await budgetStatusForMonth(userId, m, timezone);
    const lines = statuses.flatMap((s) => s.lines);
    adherence.push({
      month: m,
      lines: lines.length,
      withinLimit: lines.filter((l) => l.health !== "over").length,
      percentWithin: lines.length ? Math.round((lines.filter((l) => l.health !== "over").length / lines.length) * 100) : null,
    });
  }

  const categories = spendingBreakdown(txns.filter((t) => t.date >= monthStart(addMonths(ym, period === "monthly" ? -11 : -35)))).slices;
  const totals = rows.reduce((a, r) => ({ income: a.income + r.incomeCents, spending: a.spending + r.spendingCents }), { income: 0, spending: 0 });

  return {
    period,
    currency,
    generatedAt: new Date().toISOString(),
    rows,
    totals: { incomeCents: totals.income, spendingCents: totals.spending, netCents: totals.income - totals.spending, savingsRate: totals.income > 0 ? Math.round(((totals.income - totals.spending) / totals.income) * 1000) / 10 : null },
    categories,
    netWorth: { current: nw, history: await netWorthHistory(userId, currency, from) },
    debts,
    adherence,
    investment: await performance(userId, "1Y", timezone),
    asOf: ymd(new Date()),
  };
}
