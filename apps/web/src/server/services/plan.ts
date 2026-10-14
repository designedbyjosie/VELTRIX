/**
 * Planning services over the financial profile: what-if scenarios, purchase decisions,
 * stress tests and saved plans. The baseline always comes from the server-side profile,
 * never from the client, so a scenario can only change the inputs it names.
 */
import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  comparePlans,
  evaluatePurchase,
  formatMoney,
  LIQUID_TYPES,
  preparationSteps,
  reserveRunwayMonths,
  runScenario,
  scenarioDrivers,
  simulatePlan,
  stressChanges,
  type AccountType,
  type decisionRequestSchema,
  type PlanAssumptions,
  type PlanBaseline,
  type PlanResult,
  type planSnapshotCreateSchema,
  type ScenarioChange,
  type scenarioRequestSchema,
  type stressRequestSchema,
} from "@veltrix/shared";
import { db } from "../db";
import { cents } from "../money";
import { notFound } from "../errors";
import { addMonths, daysInMonth, fromYmd, monthRange, todayIn } from "../dates";
import { budgetStatusForMonth } from "./budgets";
import { buildProfile, type FinancialProfile } from "./twin";
import { markMemoryUsed } from "./memory";

const noteUse = (userId: string, p: FinancialProfile) => markMemoryUsed(userId, p.memory.applied.map((a) => a.id));

interface Ctx {
  timezone: string;
  currency: string;
}

const monthLabel = (startYm: string, m: number) => addMonths(startYm, m);

/** Compact monthly series for charts and snapshots. */
function series(result: PlanResult) {
  return result.months.map((m) => ({
    month: m.month,
    liquidCents: m.liquidCents,
    netWorthCents: m.netWorthCents,
    debtCents: m.debtCents,
    incomeCents: m.incomeCents,
    spendingCents: m.essentialCents + m.discretionaryCents + m.financingCents + m.oneTimeCents,
    cashflowCents: m.cashflowCents,
    goalSaved: m.goalSaved,
  }));
}

export async function runWhatIf(userId: string, input: z.infer<typeof scenarioRequestSchema>, ctx: Ctx, profile?: FinancialProfile) {
  const p = profile ?? (await buildProfile(userId, ctx));
  await noteUse(userId, p);
  const changes = input.changes as ScenarioChange[];
  const base = runScenario(p.baseline, [], input.horizonMonths, p.assumptions);
  const alt = runScenario(p.baseline, changes, input.horizonMonths, p.assumptions);
  return {
    startMonth: p.month,
    canProject: p.canProject,
    missing: p.issues.filter((i) => i.severity === "warning").map((i) => i.message),
    assumptions: p.assumptions,
    baseline: { summary: base.expected.summary, series: series(base.expected), best: base.bestMonths, adverse: base.adverseMonths },
    scenario: { summary: alt.expected.summary, series: series(alt.expected), best: alt.bestMonths, adverse: alt.adverseMonths, bestSummary: alt.best, adverseSummary: alt.adverse },
    comparison: comparePlans(base.expected.summary, alt.expected.summary),
    drivers: changes.length > 1 ? scenarioDrivers(p.baseline, changes, input.horizonMonths, p.assumptions) : [],
  };
}

type DecisionInput = Omit<z.infer<typeof decisionRequestSchema>, "alternative"> & {
  /** `verified` is set only server-side, for prices VELTRIX itself observed. */
  alternative?: { label: string; priceCents: number; verified?: boolean } | null;
};

export async function decidePurchase(userId: string, input: DecisionInput, ctx: Ctx) {
  const p = await buildProfile(userId, ctx);
  await noteUse(userId, p);
  let categoryRemainingCents: number | null = null;
  let categoryName: string | null = null;
  if (input.categorySlug) {
    const status = await budgetStatusForMonth(userId, p.month, ctx.timezone);
    const line = status.filter((b) => !b.archived).flatMap((b) => b.lines).find((l) => l.category.slug === input.categorySlug);
    if (line) {
      categoryRemainingCents = line.remainingCents;
      categoryName = line.category.name;
    }
  }
  const fmt = (c: number) => formatMoney(c, ctx.currency);
  const decision = evaluatePurchase(
    p.baseline,
    p.assumptions,
    {
      label: input.label,
      priceCents: input.priceCents,
      categoryRemainingCents,
      financing: input.financing ?? null,
      alternative: input.alternative ? { label: input.alternative.label, priceCents: input.alternative.priceCents, verified: input.alternative.verified === true } : null,
      waitMonths: input.waitMonths,
      usesPerMonth: input.usesPerMonth ?? null,
      horizonMonths: input.horizonMonths,
      cashKnown: p.figures.liquid.cents !== null,
    },
    fmt,
  );
  // Saved preferences are mentioned, never used to judge.
  const preferenceNotes: string[] = [];
  const cat = input.categorySlug ?? null;
  if (cat && p.memory.preferences.protect.some((x) => x.category === cat)) preferenceNotes.push(`You told VELTRIX ${categoryName ?? cat} matters to you. That's your call; the review above only looks at the numbers.`);
  if (cat && p.memory.preferences.flexible.some((x) => x.category === cat)) preferenceNotes.push(`You marked ${categoryName ?? cat} as flexible, the first place you'd cut back.`);
  if (p.memory.preferences.tolerance?.level === "cautious") preferenceNotes.push(`Using your cautious planning preference: the adverse case assumes spending runs ${p.assumptions.spendingVariancePct}% higher.`);
  return {
    ...decision,
    preferenceNotes,
    startMonth: p.month,
    category: categoryName ? { name: categoryName, remainingCents: categoryRemainingCents } : null,
    figures: { liquid: p.figures.liquid, income: p.figures.income, essential: p.figures.essential, surplus: p.figures.surplus },
    assumptions: p.assumptions,
    options: decision.options.map((o) => ({ key: o.key, label: o.label, summary: o.summary, adverse: o.adverse, vsSkip: o.vsSkip, changes: o.changes })),
  };
}

export async function stressTest(userId: string, input: z.infer<typeof stressRequestSchema>, ctx: Ctx) {
  const p = await buildProfile(userId, ctx);
  await noteUse(userId, p);
  const changes = stressChanges(input);
  const base = simulatePlan(p.baseline, [], input.horizonMonths, p.assumptions);
  const stressed = simulatePlan(p.baseline, changes, input.horizonMonths, p.assumptions);
  const adverse = simulatePlan(p.baseline, changes, input.horizonMonths, p.assumptions, "adverse");
  const essentialDuringStress = p.baseline.essentialCents + input.essentialIncreaseCents;
  return {
    startMonth: p.month,
    canProject: p.canProject,
    changes,
    runway: {
      // Pure reserves ÷ essentials, ignoring any income: the most conservative view.
      noIncomeMonths: reserveRunwayMonths(Math.max(0, p.baseline.liquidCents - input.emergencyCostCents), essentialDuringStress),
      firstNegativeMonth: stressed.summary.firstNegativeMonth,
      adverseFirstNegativeMonth: adverse.summary.firstNegativeMonth,
    },
    baseline: { summary: base.summary, series: series(base) },
    stressed: { summary: stressed.summary, series: series(stressed) },
    comparison: comparePlans(base.summary, stressed.summary),
    steps: withPriorities(preparationSteps(p.baseline, stressed.summary, p.assumptions, p.figures.recurringMonthlyCents), p),
    assumptions: p.assumptions,
  };
}

/** Put the categories the user said they'd cut first at the top of the preparation steps. */
function withPriorities(steps: ReturnType<typeof preparationSteps>, p: FinancialProfile) {
  const flexible = p.memory.preferences.flexible.map((x) => x.category);
  if (!flexible.length) return steps;
  const monthly = (slug: string) => p.categories.find((c) => c.slug === slug)?.monthlyCents ?? p.budget.find((b) => b.slug === slug)?.limitCents ?? 0;
  const names = flexible.map((slug) => p.categories.find((c) => c.slug === slug)?.name ?? p.budget.find((b) => b.slug === slug)?.name ?? slug);
  const total = flexible.reduce((s, slug) => s + monthly(slug), 0);
  return [{ title: `Pause your flexible spending first: ${names.join(", ")}`, detail: "You told VELTRIX these are the first places you'd cut back. Pausing them in a hard month extends how long your reserves last.", impactCents: total || null }, ...steps.filter((x) => !/pause first/.test(x.title))];
}

// ---------------------------------------------------------------- Saved plans ("time machine")

export async function savePlan(userId: string, input: z.infer<typeof planSnapshotCreateSchema>, ctx: Ctx) {
  const p = await buildProfile(userId, ctx);
  const result = simulatePlan(p.baseline, input.changes as ScenarioChange[], input.horizonMonths, p.assumptions);
  const liquidAccountIds = p.accounts.filter((a) => a.included && LIQUID_TYPES.includes(a.type as AccountType)).map((a) => a.id);
  const snap = await db.planSnapshot.create({
    data: {
      userId,
      name: input.name,
      kind: input.kind,
      startMonth: p.month,
      baseline: { ...p.baseline, liquidAccountIds, essentialCategories: p.settings.essentialCategories, currency: ctx.currency } as unknown as Prisma.InputJsonValue,
      assumptions: p.assumptions as unknown as Prisma.InputJsonValue,
      changes: input.changes as unknown as Prisma.InputJsonValue,
      result: { summary: result.summary, series: series(result) } as unknown as Prisma.InputJsonValue,
      decision: (input.decision ?? undefined) as Prisma.InputJsonValue | undefined,
      note: input.note,
    },
  });
  return { id: snap.id };
}

export async function listPlans(userId: string) {
  const rows = await db.planSnapshot.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, name: true, kind: true, startMonth: true, createdAt: true, decision: true } });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function deletePlan(userId: string, id: string) {
  const r = await db.planSnapshot.deleteMany({ where: { id, userId } });
  if (!r.count) throw notFound("Saved plan");
}

type StoredBaseline = PlanBaseline & { liquidAccountIds: string[]; essentialCategories: string[]; currency: string };
type StoredSeries = ReturnType<typeof series>;

/**
 * Compare a saved plan with what actually happened. The saved projection is never
 * modified; actual figures come from balance history, transactions and contributions
 * for each month that has elapsed.
 */
export async function comparePlanWithActual(userId: string, id: string, ctx: Ctx) {
  const snap = await db.planSnapshot.findFirst({ where: { id, userId } });
  if (!snap) throw notFound("Saved plan");
  const baseline = snap.baseline as unknown as StoredBaseline;
  const assumptions = snap.assumptions as unknown as PlanAssumptions;
  const projected = (snap.result as unknown as { summary: PlanResult["summary"]; series: StoredSeries }).series;
  const summary = (snap.result as unknown as { summary: PlanResult["summary"] }).summary;
  const today = todayIn(ctx.timezone);
  const thisMonth = today.slice(0, 7);
  const elapsed = Math.max(0, (Number(thisMonth.slice(0, 4)) - Number(snap.startMonth.slice(0, 4))) * 12 + Number(thisMonth.slice(5, 7)) - Number(snap.startMonth.slice(5, 7)));
  const goalIds = baseline.goals.map((g) => g.id);

  const rows = [];
  for (let m = 0; m <= Math.min(elapsed, projected.length - 1); m++) {
    const ym = monthLabel(snap.startMonth, m);
    const complete = ym < thisMonth;
    const endDate = complete ? `${ym}-${String(daysInMonth(ym)).padStart(2, "0")}` : today;
    const [balances, flows, contributions, goalRows] = await Promise.all([
      baseline.liquidAccountIds.length
        ? db.$queryRaw<{ total: number | null; n: bigint }[]>`
            SELECT SUM(b.balance)::float AS total, COUNT(*) AS n FROM (
              SELECT DISTINCT ON ("accountId") "accountId", balance FROM "AccountBalance"
              WHERE "userId" = ${userId} AND "accountId" = ANY(${baseline.liquidAccountIds}) AND "asOf" <= ${fromYmd(endDate)}
              ORDER BY "accountId", "asOf" DESC) b`
        : Promise.resolve([{ total: null, n: BigInt(0) }]),
      db.transaction.findMany({ where: { userId, currency: baseline.currency, date: monthRange(ym) }, select: { amount: true, category: { select: { kind: true } } } }),
      db.goalContribution.groupBy({ by: ["goalId"], where: { userId, goalId: { in: goalIds }, date: { lte: fromYmd(endDate) } }, _sum: { amount: true } }),
      db.savingsGoal.findMany({ where: { userId, id: { in: goalIds } }, select: { id: true, startingAmount: true } }),
    ]);
    let income = 0;
    let spending = 0;
    for (const t of flows) {
      const c = cents(t.amount);
      if (t.category?.kind === "TRANSFER") continue;
      if (t.category?.kind === "INCOME" && c > 0) income += c;
      else if (c < 0) spending += -c;
    }
    const liquidKnown = Number(balances[0]?.n ?? 0) > 0;
    const goalSaved: Record<string, number> = {};
    for (const g of goalRows) goalSaved[g.id] = cents(g.startingAmount) + cents(contributions.find((c) => c.goalId === g.id)?._sum.amount ?? 0);
    const p = projected[m];
    rows.push({
      month: m,
      ym,
      complete,
      projected: { liquidCents: p.liquidCents, incomeCents: p.incomeCents, spendingCents: p.spendingCents, goalSaved: p.goalSaved },
      actual: { liquidCents: liquidKnown ? Math.round((balances[0].total ?? 0) * 100) : null, incomeCents: flows.length ? income : null, spendingCents: flows.length ? spending : null, goalSaved },
    });
  }

  // Assumption accuracy over completed months with data
  const done = rows.filter((r) => r.complete && r.actual.spendingCents !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const fmt = (c: number) => formatMoney(c, baseline.currency);
  const findings: { kind: "accurate" | "differs" | "info"; text: string }[] = [];
  const actualIncome = avg(done.map((r) => r.actual.incomeCents ?? 0));
  const actualSpend = avg(done.map((r) => r.actual.spendingCents ?? 0));
  const plannedSpend = baseline.essentialCents + baseline.discretionaryCents;
  if (!done.length) findings.push({ kind: "info", text: elapsed === 0 ? "This plan was saved this month. Check back after the month ends to compare it with what happened." : "There aren't transactions for the elapsed months yet, so spending and income can't be compared." });
  if (actualIncome !== null && baseline.monthlyIncomeCents > 0) {
    const diff = actualIncome - baseline.monthlyIncomeCents;
    findings.push(Math.abs(diff) <= baseline.monthlyIncomeCents * 0.05 ? { kind: "accurate", text: `Income matched the plan (${fmt(actualIncome)} a month vs ${fmt(baseline.monthlyIncomeCents)} assumed).` } : { kind: "differs", text: `Income averaged ${fmt(actualIncome)} a month, ${diff > 0 ? "above" : "below"} the ${fmt(baseline.monthlyIncomeCents)} the plan assumed.` });
  }
  if (actualSpend !== null && plannedSpend > 0) {
    const diff = actualSpend - plannedSpend;
    findings.push(Math.abs(diff) <= plannedSpend * 0.05 ? { kind: "accurate", text: `Spending matched the plan (${fmt(actualSpend)} a month).` } : { kind: "differs", text: `Spending averaged ${fmt(actualSpend)} a month, ${fmt(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than planned.` });
  }
  // Cash is judged at the end of a finished month; a month in progress isn't comparable yet.
  const last = [...rows].reverse().find((r) => r.complete && r.actual.liquidCents !== null);
  if (last) {
    const diff = last.actual.liquidCents! - last.projected.liquidCents;
    const label = new Date(`${last.ym}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    findings.push({ kind: Math.abs(diff) <= Math.max(10_000, Math.abs(last.projected.liquidCents) * 0.05) ? "accurate" : "differs", text: `Cash at the end of ${label} was ${fmt(last.actual.liquidCents!)} vs ${fmt(last.projected.liquidCents)} projected.` });
  }

  // Are the goals still on track? Re-project from today's profile with the same changes still ahead.
  const current = await buildProfile(userId, ctx);
  const remainingChanges = (snap.changes as unknown as ScenarioChange[])
    .map((c) => shiftChange(c, elapsed))
    .filter((c): c is ScenarioChange => c !== null);
  const now = simulatePlan(current.baseline, remainingChanges, Math.max(3, summary.horizonMonths - elapsed), current.assumptions);
  const goals = summary.goals.map((g) => {
    const n = now.summary.goals.find((x) => x.id === g.id);
    return {
      id: g.id,
      name: g.name,
      plannedMonth: g.completionMonth === null ? null : monthLabel(snap.startMonth, g.completionMonth),
      nowMonth: n?.completionMonth == null ? null : monthLabel(thisMonth, n.completionMonth),
      stillExists: !!n,
    };
  });

  return {
    id: snap.id,
    name: snap.name,
    kind: snap.kind,
    note: snap.note,
    createdAt: snap.createdAt.toISOString(),
    startMonth: snap.startMonth,
    elapsedMonths: elapsed,
    baseline: { ...baseline, liquidAccountIds: undefined },
    assumptions,
    changes: snap.changes,
    decision: snap.decision,
    summary,
    projected,
    rows,
    findings,
    goals,
  };
}

/** Re-express a saved change relative to a later "month 0"; drop it if it's fully in the past. */
function shiftChange(c: ScenarioChange, by: number): ScenarioChange | null {
  if (by === 0) return c;
  switch (c.kind) {
    case "one_time":
      return c.month >= by ? { ...c, month: c.month - by } : null;
    case "income":
    case "expense": {
      const end = c.months === null ? null : c.startMonth + c.months;
      if (end !== null && end <= by) return null;
      const start = Math.max(0, c.startMonth - by);
      return { ...c, startMonth: start, months: end === null ? null : end - by - start };
    }
    case "financed_purchase": {
      const end = c.startMonth + c.months;
      if (end <= by) return null;
      const paid = Math.max(0, by - c.startMonth);
      // Remaining payments only; principal already repaid isn't re-borrowed.
      return { ...c, startMonth: Math.max(0, c.startMonth - by), months: c.months - paid, amountCents: Math.round((c.amountCents * (c.months - paid)) / c.months) };
    }
    default:
      return { ...c, startMonth: Math.max(0, c.startMonth - by) };
  }
}
