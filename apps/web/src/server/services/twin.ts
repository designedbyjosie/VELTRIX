/**
 * VELTRIX financial profile ("digital twin"): one explainable picture of the user's
 * finances that powers planning, scenarios, purchase decisions, stress tests and the
 * advisor. Every figure records where it came from (bank sync, import, user entry,
 * budget, or an estimate) and how fresh it is. Missing information stays missing:
 * nothing here invents a balance, income or expense.
 */
import { DEFAULT_ASSUMPTIONS, formatMoney, isLiability, LIQUID_TYPES, INVESTMENT_TYPES, type AccountType, type PlanAssumptions, type PlanBaseline, type PlanningAssumptionsInput } from "@veltrix/shared";
import { db } from "../db";
import { cents } from "../money";
import { addDays, addMonths, fromYmd, monthStart, todayIn, ymd } from "../dates";
import { listGoals } from "./goals";
import { activeBudgetId } from "./budgets";

export type FigureSource = "bank" | "imported" | "entered" | "budget" | "estimated" | "missing";

export interface Figure {
  cents: number | null;
  source: FigureSource;
  /** Plain-language explanation of how the number was produced. */
  basis: string;
  asOf: string | null;
  stale: boolean;
}

export interface DataIssue {
  severity: "info" | "warning";
  message: string;
  href: string | null;
}

export const DEFAULT_ESSENTIAL_CATEGORIES = ["housing", "utilities", "health", "transport", "food"];
const STALE_MANUAL_DAYS = 31;
const STALE_SYNC_DAYS = 3;

export interface StoredAssumptions {
  emergencyMonths: number;
  annualReturnPct: PlanAssumptions["annualReturnPct"];
  spendingVariancePct: number | null;
  essentialCategories: string[];
  excludedAccountIds: string[];
  debts: Record<string, { aprPercent: number | null; monthlyPaymentCents: number }>;
}

export function readAssumptions(raw: unknown): StoredAssumptions {
  const a = (raw && typeof raw === "object" ? raw : {}) as PlanningAssumptionsInput;
  return {
    emergencyMonths: a.emergencyMonths ?? DEFAULT_ASSUMPTIONS.emergencyMonths,
    annualReturnPct: a.annualReturnPct ?? DEFAULT_ASSUMPTIONS.annualReturnPct,
    spendingVariancePct: a.spendingVariancePct ?? null,
    essentialCategories: a.essentialCategories ?? DEFAULT_ESSENTIAL_CATEGORIES,
    excludedAccountIds: a.excludedAccountIds ?? [],
    debts: a.debts ?? {},
  };
}

export async function saveAssumptions(userId: string, patch: PlanningAssumptionsInput) {
  const p = await db.userProfile.findUnique({ where: { userId }, select: { planningAssumptions: true } });
  const current = (p?.planningAssumptions && typeof p.planningAssumptions === "object" ? p.planningAssumptions : {}) as Record<string, unknown>;
  const next = { ...current, ...patch };
  await db.userProfile.update({ where: { userId }, data: { planningAssumptions: next } });
  return readAssumptions(next);
}

const monthsBetween = (fromYm: string, toYm: string) => (Number(toYm.slice(0, 4)) - Number(fromYm.slice(0, 4))) * 12 + Number(toYm.slice(5, 7)) - Number(fromYm.slice(5, 7));

interface Ctx {
  timezone: string;
  currency: string;
}

export async function buildProfile(userId: string, ctx: Ctx) {
  const today = todayIn(ctx.timezone);
  const thisMonth = today.slice(0, 7);
  const histFrom = monthStart(addMonths(thisMonth, -3));
  const histTo = monthStart(thisMonth);

  const [profile, accountsAll, plaidItems, goals, recurring, txGroups, txMonths, categories] = await Promise.all([
    db.userProfile.findUnique({ where: { userId }, select: { monthlyIncome: true, planningAssumptions: true, updatedAt: true } }),
    db.connectedAccount.findMany({ where: { userId, archivedAt: null }, orderBy: { name: "asc" } }),
    db.plaidItem.findMany({ where: { userId }, select: { id: true, lastSyncedAt: true, status: true, institutionName: true } }),
    listGoals(userId, ctx.timezone),
    db.recurringPayment.findMany({ where: { userId, status: { in: ["CONFIRMED", "SUSPECTED"] } }, include: { category: true } }),
    db.transaction.groupBy({
      by: ["categoryId", "source"],
      where: { userId, currency: ctx.currency, date: { gte: fromYmd(histFrom), lt: fromYmd(histTo) } },
      _sum: { amount: true },
    }),
    db.$queryRaw<{ m: string }[]>`SELECT DISTINCT to_char("date", 'YYYY-MM') AS m FROM "Transaction" WHERE "userId" = ${userId} AND "date" >= ${fromYmd(histFrom)} AND "date" < ${fromYmd(histTo)}`,
    db.transactionCategory.findMany({ where: { OR: [{ userId: null }, { userId }] }, select: { id: true, slug: true, name: true, kind: true } }),
  ]);
  const assumptions = readAssumptions(profile?.planningAssumptions);
  const issues: DataIssue[] = [];
  const catById = new Map(categories.map((c) => [c.id, c]));

  // ---------------- Accounts
  const itemById = new Map(plaidItems.map((i) => [i.id, i]));
  const accounts = accountsAll.map((a) => {
    const item = a.plaidItemId ? itemById.get(a.plaidItemId) : null;
    const syncedAt = item?.lastSyncedAt ?? null;
    const asOf = a.source === "AGGREGATOR" ? syncedAt : a.balanceAsOf;
    const ageDays = asOf ? (Date.now() - asOf.getTime()) / 86_400_000 : Infinity;
    const stale = a.source === "AGGREGATOR" ? ageDays > STALE_SYNC_DAYS || item?.status !== "ok" : ageDays > STALE_MANUAL_DAYS;
    return {
      id: a.id,
      name: a.name,
      type: a.type as AccountType,
      currency: a.currency,
      balanceCents: cents(a.currentBalance),
      source: (a.source === "AGGREGATOR" ? "bank" : a.source === "CSV" ? "imported" : "entered") as FigureSource,
      asOf: asOf?.toISOString() ?? null,
      stale,
      included: !assumptions.excludedAccountIds.includes(a.id) && a.currency === ctx.currency,
      excludedReason: assumptions.excludedAccountIds.includes(a.id) ? "You excluded it from planning" : a.currency !== ctx.currency ? `Held in ${a.currency}` : null,
    };
  });
  const used = accounts.filter((a) => a.included);
  for (const a of used.filter((x) => x.stale)) {
    issues.push({ severity: "warning", message: a.source === "bank" ? `${a.name} hasn't synced recently. Projections use its last known balance.` : `${a.name}'s balance was last updated ${a.asOf ? a.asOf.slice(0, 10) : "a while ago"}. Update it for accurate projections.`, href: "/app/overview" });
  }
  const sumOf = (types: AccountType[]) => used.filter((a) => types.includes(a.type)).reduce((s, a) => s + a.balanceCents, 0);
  const sourceOf = (list: typeof used): FigureSource => (list.length === 0 ? "missing" : list.every((a) => a.source === "bank") ? "bank" : "entered");
  const liquidAccounts = used.filter((a) => LIQUID_TYPES.includes(a.type));
  const investAccounts = used.filter((a) => INVESTMENT_TYPES.includes(a.type));
  const debtAccounts = used.filter((a) => isLiability(a.type) && a.balanceCents !== 0);
  const oldest = (list: typeof used) => list.map((a) => a.asOf).filter(Boolean).sort()[0] ?? null;

  const liquid: Figure = {
    cents: liquidAccounts.length ? sumOf(LIQUID_TYPES) : null,
    source: sourceOf(liquidAccounts),
    basis: liquidAccounts.length ? `Checking, savings and cash: ${liquidAccounts.map((a) => a.name).join(", ")}` : "No checking, savings or cash accounts yet",
    asOf: oldest(liquidAccounts),
    stale: liquidAccounts.some((a) => a.stale),
  };
  if (!liquidAccounts.length) issues.push({ severity: "warning", message: "Add a checking or savings account so VELTRIX knows your available cash.", href: "/app/overview?new=1" });

  const debts = debtAccounts.map((a) => {
    const terms = assumptions.debts[a.id];
    return { id: a.id, name: a.name, balanceCents: Math.abs(a.balanceCents), aprPercent: terms?.aprPercent ?? null, monthlyPaymentCents: terms?.monthlyPaymentCents ?? 0, termsEntered: !!terms };
  });
  for (const d of debts.filter((x) => !x.termsEntered)) issues.push({ severity: "info", message: `Add the interest rate and monthly payment for ${d.name} to model its payoff and interest.`, href: "/app/plan?tab=assumptions" });

  // ---------------- Spending and income from the last full months
  const monthsCovered = Math.max(0, Math.min(3, txMonths.length));
  const essentialSet = new Set(assumptions.essentialCategories);
  const byCategory = new Map<string, { slug: string; name: string; cents: number; essential: boolean }>();
  let incomeTotal = 0;
  let incomeFromBank = 0;
  let spendFromBank = 0;
  let spendTotal = 0;
  for (const g of txGroups) {
    const cat = g.categoryId ? catById.get(g.categoryId) : null;
    const total = cents(g._sum.amount);
    if (cat?.kind === "TRANSFER") continue;
    if (cat?.kind === "INCOME") {
      if (total > 0) {
        incomeTotal += total;
        if (g.source === "AGGREGATOR") incomeFromBank += total;
      }
      continue;
    }
    const slug = cat?.slug ?? "uncategorized";
    const row = byCategory.get(slug) ?? { slug, name: cat?.name ?? "Uncategorized", cents: 0, essential: essentialSet.has(slug) };
    row.cents += -total;
    byCategory.set(slug, row);
    spendTotal += -total;
    if (g.source === "AGGREGATOR") spendFromBank += -total;
  }
  const perMonth = (c: number) => (monthsCovered ? Math.round(c / monthsCovered) : 0);
  const categoriesMonthly = [...byCategory.values()].filter((c) => c.cents > 0).map((c) => ({ ...c, monthlyCents: perMonth(c.cents) })).sort((a, b) => b.monthlyCents - a.monthlyCents);

  // Fall back to the budget when there's no transaction history.
  let spendSource: FigureSource = monthsCovered ? (spendFromBank >= spendTotal * 0.5 ? "bank" : "imported") : "missing";
  let essentialMonthly = categoriesMonthly.filter((c) => c.essential).reduce((s, c) => s + c.monthlyCents, 0);
  let discretionaryMonthly = categoriesMonthly.filter((c) => !c.essential).reduce((s, c) => s + c.monthlyCents, 0);
  let spendBasis = monthsCovered ? `Average of ${monthsCovered} full month${monthsCovered === 1 ? "" : "s"} of transactions (${histFrom.slice(0, 7)} to ${addMonths(thisMonth, -1)})` : "";
  let budgetLines: { slug: string; name: string; limitCents: number; essential: boolean }[] = [];
  const budgetId = await activeBudgetId(userId, thisMonth);
  if (budgetId) {
    const lines = await db.budgetCategory.findMany({ where: { budgetId }, include: { category: true } });
    budgetLines = lines.map((l) => ({ slug: l.category.slug, name: l.category.name, limitCents: cents(l.limitAmount), essential: essentialSet.has(l.category.slug) }));
  }
  // Sparse transaction history (e.g. a few charges logged by hand) would understate spending,
  // so when a budget exists and recorded spending covers less than half of it, use the budget.
  const budgetTotal = budgetLines.reduce((s, l) => s + l.limitCents, 0);
  const recordedMonthly = essentialMonthly + discretionaryMonthly;
  const sparse = monthsCovered > 0 && budgetTotal > 0 && recordedMonthly < budgetTotal * 0.5;
  if ((!monthsCovered || sparse) && budgetLines.length) {
    spendSource = "budget";
    essentialMonthly = budgetLines.filter((l) => l.essential).reduce((s, l) => s + l.limitCents, 0);
    discretionaryMonthly = budgetLines.filter((l) => !l.essential).reduce((s, l) => s + l.limitCents, 0);
    spendBasis = sparse
      ? `Your monthly budget limits. Recorded transactions average only ${formatMoney(recordedMonthly, ctx.currency)} a month, less than half your budget, so they look incomplete`
      : "Your monthly budget limits (no full month of transactions yet)";
    if (sparse) issues.push({ severity: "info", message: "Your recorded transactions look incomplete compared with your budget, so planning uses your budget. Connect a bank or import a CSV for actual spending.", href: "/app/transactions?import=1" });
  }
  if (spendSource === "missing") {
    spendBasis = "No transactions or budget yet";
    issues.push({ severity: "warning", message: "Add transactions (connect a bank or import a CSV) or set a budget so VELTRIX knows your monthly spending.", href: "/app/setup" });
  } else if (monthsCovered === 1 && spendSource !== "budget") {
    issues.push({ severity: "info", message: "Spending is based on one month of history. Estimates improve with three.", href: null });
  }

  const enteredIncome = profile?.monthlyIncome ? cents(profile.monthlyIncome) : null;
  const observedIncome = monthsCovered && incomeTotal > 0 ? perMonth(incomeTotal) : null;
  const income: Figure =
    enteredIncome !== null
      ? { cents: enteredIncome, source: "entered", basis: `Take-home income you entered${observedIncome !== null ? `; deposits averaged ${formatMoney(observedIncome, ctx.currency)} a month recently` : ""}`, asOf: profile!.updatedAt.toISOString(), stale: false }
      : observedIncome !== null
        ? { cents: observedIncome, source: incomeFromBank >= incomeTotal * 0.5 ? "bank" : "imported", basis: `Average income deposits over ${monthsCovered} full month${monthsCovered === 1 ? "" : "s"}`, asOf: null, stale: false }
        : { cents: null, source: "missing", basis: "No income entered or detected", asOf: null, stale: false };
  if (income.source === "missing") issues.push({ severity: "warning", message: "Add your monthly take-home income so projections include money coming in.", href: "/app/advisor?q=I%20make%20%24%20a%20month" });
  if (enteredIncome !== null && observedIncome !== null && Math.abs(observedIncome - enteredIncome) > enteredIncome * 0.25) {
    issues.push({ severity: "info", message: "Your recent deposits differ from the income you entered by more than 25%. Check that your income is still right.", href: "/app/plan?tab=assumptions" });
  }

  // Spending variability from monthly discretionary totals, when there's enough history.
  let derivedVariance: number | null = null;
  if (monthsCovered >= 2) {
    const monthly = await db.$queryRaw<{ m: string; total: number }[]>`
      SELECT to_char(t."date", 'YYYY-MM') AS m, -SUM(t."amount")::float AS total
      FROM "Transaction" t LEFT JOIN "TransactionCategory" c ON c.id = t."categoryId"
      WHERE t."userId" = ${userId} AND t."currency" = ${ctx.currency} AND t."amount" < 0
        AND t."date" >= ${fromYmd(histFrom)} AND t."date" < ${fromYmd(histTo)}
        AND (c.kind IS NULL OR c.kind = 'EXPENSE') AND (c.slug IS NULL OR NOT (c.slug = ANY(${assumptions.essentialCategories})))
      GROUP BY 1`;
    const vals = monthly.map((r) => Number(r.total));
    if (vals.length >= 2) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
      if (mean > 0) derivedVariance = Math.round(Math.min(50, Math.max(5, (sd / mean) * 100)));
    }
  }
  const spendingVariancePct = assumptions.spendingVariancePct ?? derivedVariance ?? DEFAULT_ASSUMPTIONS.spendingVariancePct;

  // ---------------- Commitments in the next 30 days
  const horizon = addDays(today, 30);
  const commitments = recurring
    .filter((r) => r.currency === ctx.currency && r.nextExpectedAt && ymd(r.nextExpectedAt) >= today && ymd(r.nextExpectedAt) <= horizon)
    .map((r) => ({ id: r.id, merchant: r.merchant, amountCents: cents(r.amount), due: ymd(r.nextExpectedAt!), confirmed: r.status === "CONFIRMED", category: r.category?.name ?? null }))
    .sort((a, b) => a.due.localeCompare(b.due));
  const perYear = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1, UNKNOWN: 0 } as const;
  const recurringMonthlyCents = Math.round(recurring.filter((r) => r.currency === ctx.currency).reduce((s, r) => s + (cents(r.amount) * perYear[r.frequency]) / 12, 0));

  // ---------------- Goals
  const planGoals = goals
    .filter((g) => g.currency === ctx.currency)
    .map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: g.targetCents,
      savedCents: g.savedCents,
      monthlyCents: g.plannedMonthlyCents ?? 0,
      targetMonth: g.targetDate ? Math.max(0, monthsBetween(thisMonth, g.targetDate.slice(0, 7))) : null,
    }));
  for (const g of planGoals.filter((x) => x.savedCents < x.targetCents && x.monthlyCents === 0)) issues.push({ severity: "info", message: `Set a monthly amount for "${g.name}" to project when you'll reach it.`, href: "/app/goals" });

  const baseline: PlanBaseline = {
    liquidCents: liquid.cents ?? 0,
    investmentsCents: sumOf(INVESTMENT_TYPES),
    debts: debts.map(({ termsEntered: _t, ...d }) => d),
    monthlyIncomeCents: income.cents ?? 0,
    essentialCents: essentialMonthly,
    discretionaryCents: discretionaryMonthly,
    goals: planGoals,
  };
  const planAssumptions: PlanAssumptions = { annualReturnPct: assumptions.annualReturnPct, spendingVariancePct, emergencyMonths: assumptions.emergencyMonths };
  const goalSaving = planGoals.filter((g) => g.savedCents < g.targetCents).reduce((s, g) => s + g.monthlyCents, 0);
  const debtPayments = debts.reduce((s, d) => s + d.monthlyPaymentCents, 0);
  const surplus = income.cents === null || spendSource === "missing" ? null : income.cents - essentialMonthly - discretionaryMonthly - debtPayments;

  const figures = {
    income,
    liquid,
    investments: { cents: investAccounts.length ? baseline.investmentsCents : null, source: sourceOf(investAccounts), basis: investAccounts.length ? `Investment and retirement accounts: ${investAccounts.map((a) => a.name).join(", ")}` : "No investment accounts", asOf: oldest(investAccounts), stale: investAccounts.some((a) => a.stale) } as Figure,
    debt: { cents: debts.reduce((s, d) => s + d.balanceCents, 0), source: sourceOf(debtAccounts.length ? debtAccounts : []), basis: debts.length ? `Balances owed: ${debts.map((d) => d.name).join(", ")}` : "No debts recorded", asOf: oldest(debtAccounts), stale: debtAccounts.some((a) => a.stale) } as Figure,
    essential: { cents: spendSource === "missing" ? null : essentialMonthly, source: spendSource, basis: `${spendBasis}. Essential categories: ${assumptions.essentialCategories.join(", ")}`, asOf: null, stale: false } as Figure,
    discretionary: { cents: spendSource === "missing" ? null : discretionaryMonthly, source: spendSource, basis: `${spendBasis}. Everything not marked essential`, asOf: null, stale: false } as Figure,
    surplus: { cents: surplus, source: surplus === null ? "missing" : "estimated", basis: "Income − essential − discretionary spending − debt payments you entered (before goal saving)", asOf: null, stale: false } as Figure,
    reserveMonths: essentialMonthly > 0 && liquid.cents !== null ? Math.round((liquid.cents / essentialMonthly) * 10) / 10 : null,
    goalSavingCents: goalSaving,
    recurringMonthlyCents,
  };

  return {
    asOf: new Date().toISOString(),
    month: thisMonth,
    currency: ctx.currency,
    baseline,
    assumptions: planAssumptions,
    settings: { ...assumptions, derivedSpendingVariancePct: derivedVariance },
    figures,
    accounts,
    debts,
    categories: spendSource === "budget" ? [] : categoriesMonthly.map(({ slug, name, monthlyCents, essential }) => ({ slug, name, monthlyCents, essential })),
    budget: budgetLines,
    commitments,
    goals: planGoals,
    monthsOfHistory: monthsCovered,
    issues,
    canProject: income.cents !== null && spendSource !== "missing",
  };
}

export type FinancialProfile = Awaited<ReturnType<typeof buildProfile>>;
