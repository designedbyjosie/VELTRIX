import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftRight, ArrowRight, Landmark, PenLine, PieChart, Sparkles, Target, Wallet } from "lucide-react";
import { normalizeLayout, type DashboardWidget } from "@veltrix/shared";
import { requireUser } from "@/server/current-user";
import { db } from "@/server/db";
import { dashboardSummary, spendingOverview } from "@/server/services/dashboard";
import { performance } from "@/server/services/investments";
import { listInsights, refreshInsights } from "@/server/services/insights";
import { listGoals } from "@/server/services/goals";
import { budgetStatusForMonth } from "@/server/services/budgets";
import { cents } from "@/server/money";
import { todayIn } from "@/server/dates";
import { DashboardCustomizer } from "@/components/dashboard/customize";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SpendingCard } from "@/components/dashboard/spending-card";
import { PerformanceCard } from "@/components/dashboard/performance-card";
import { AdvisorHighlight, InsightCard } from "@/components/dashboard/insight-card";
import { Badge, Card, DemoBadge, EmptyState, LinkButton, Progress } from "@/components/ui";
import { money, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Home" };

function SetupChoice({ href, icon, title, body, cta, recommended }: { href: string; icon: React.ReactNode; title: string; body: string; cta: string; recommended?: boolean }) {
  return (
    <Link href={href} className="panel group flex flex-col p-6 transition hover:border-blue/60 focus-visible:border-blue">
      <span className="mb-4 flex items-center justify-between">
        <span className="grid size-12 place-items-center rounded-[14px] bg-blue/10 text-cyan">{icon}</span>
        {recommended && <Badge tone="pos">Fastest</Badge>}
      </span>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 flex-1 text-sm text-ink2">{body}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-cyan">
        {cta} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

function greeting(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date())) % 24;
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const user = await requireUser();
  const [accountCount, txnCount] = await Promise.all([db.connectedAccount.count({ where: { userId: user.id } }), db.transaction.count({ where: { userId: user.id } })]);
  const firstName = user.displayName.split(" ")[0];

  if (accountCount === 0 && txnCount === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">
            {greeting(user.timezone)}, {firstName}.
          </h1>
          <p className="mt-1 text-ink2">Let&apos;s set up your financial picture. It takes about five minutes, and you choose how much to share.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SetupChoice
            href="/app/setup?path=bank"
            icon={<Landmark className="size-6" aria-hidden />}
            title="Connect my bank"
            body="Link accounts securely through Plaid. Balances and transactions stay up to date automatically. VELTRIX never sees your bank password."
            cta="Connect and set up"
            recommended
          />
          <SetupChoice
            href="/app/setup?path=manual"
            icon={<PenLine className="size-6" aria-hidden />}
            title="Enter it myself"
            body="Prefer not to link a bank? We'll walk you through adding your balances, income, monthly bills and a goal, one step at a time."
            cta="Start step by step"
          />
        </div>
        <p className="text-sm text-ink3">
          Other ways to start: <Link href="/app/transactions?import=1" className="text-cyan hover:underline">import a CSV from your bank</Link> or{" "}
          <Link href="/app/settings#extension" className="text-cyan hover:underline">connect the browser extension</Link>.
        </p>
      </div>
    );
  }

  const latest = await db.financialInsight.findFirst({ where: { userId: user.id }, orderBy: { generatedAt: "desc" }, select: { generatedAt: true } });
  if (!latest || Date.now() - latest.generatedAt.getTime() > 60 * 60 * 1000) await refreshInsights(user.id, user.timezone, user.baseCurrency);

  const ym = todayIn(user.timezone).slice(0, 7);
  const [summary, spending, perf, insights, goals, budgets, profile] = await Promise.all([
    dashboardSummary(user.id, user.timezone, user.baseCurrency),
    spendingOverview(user.id, "month", user.timezone, user.baseCurrency),
    performance(user.id, "1Y", user.timezone),
    listInsights(user.id, 8),
    listGoals(user.id, user.timezone),
    budgetStatusForMonth(user.id, ym, user.timezone),
    db.userProfile.findUnique({ where: { userId: user.id }, select: { monthlyIncome: true, dashboardLayout: true } }),
  ]);
  const c = user.baseCurrency;
  const nwSpark = summary.history.slice(-60).map((p) => p.netWorthCents);
  const layout = normalizeLayout(profile?.dashboardLayout);
  const budget = budgets.find((b) => !b.archived) ?? null;
  const incomeCents = profile?.monthlyIncome ? cents(profile.monthlyIncome) : null;
  const goalSavingCents = goals.reduce((s, g) => s + (g.currency === c && g.projection.remainingCents > 0 ? (g.plannedMonthlyCents ?? 0) : 0), 0);

  const widgets: Record<DashboardWidget, { size: "full" | "half"; node: React.ReactNode }> = {
    metrics: {
      size: "full",
      node: (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total net worth" value={money(summary.netWorth.cents, c)} change={summary.netWorth.changePercent} comparison={summary.netWorth.comparisonLabel} href="/app/overview" spark={nwSpark} sparkColor="#26D9A0" note={summary.netWorth.excludedForeignCurrency ? `${summary.netWorth.excludedForeignCurrency} foreign-currency account(s) not included` : undefined} />
          <MetricCard label="Monthly spending" value={money(summary.monthlySpending.cents, c)} change={summary.monthlySpending.changePercent} goodWhen="down" comparison={summary.monthlySpending.comparisonLabel} href="/app/transactions" />
          <MetricCard label="Total savings" value={money(summary.savings.cents, c)} change={summary.savings.changePercent} comparison={summary.savings.comparisonLabel} href="/app/savings" note={summary.savings.accountCount ? undefined : "Add a savings account to track this"} />
          <MetricCard label="Investments" value={money(summary.investments.cents, c)} change={summary.investments.changePercent} comparison={summary.investments.comparisonLabel} href="/app/investments" note={summary.investments.accountCount ? "Includes contributions — see return below" : "Add an investment account to track this"} />
        </div>
      ),
    },
    plan: { size: "full", node: <MonthlyPlan currency={c} incomeCents={incomeCents} budgetedCents={budget?.limitCents ?? null} goalSavingCents={goalSavingCents} spentCents={summary.monthlySpending.cents} /> },
    spending: { size: "half", node: <SpendingCard initial={spending} /> },
    performance: { size: "half", node: <PerformanceCard initial={perf} currency={c} /> },
    budget: {
      size: "half",
      node: (
        <Card
          title="Budget progress"
          action={
            <Link href="/app/budgets" className="text-xs text-cyan hover:underline">
              All budgets
            </Link>
          }
        >
          {!budget ? (
            <EmptyState icon={<PieChart className="size-5" />} title="No budget this month" body="Set monthly limits per category, or ask the advisor: “set my food budget to $400”." action={<LinkButton href="/app/budgets" size="sm">Create a budget</LinkButton>} />
          ) : (
            <ul className="space-y-3.5">
              <li className="num flex items-baseline justify-between text-sm">
                <span className="text-ink2">Spent this month</span>
                <span>
                  {money(budget.spentCents, budget.currency, { noCents: true })} <span className="text-ink3">of {money(budget.limitCents, budget.currency, { noCents: true })}</span>
                </span>
              </li>
              {[...budget.lines]
                .sort((a, b) => b.percentUsed - a.percentUsed)
                .slice(0, 5)
                .map((l) => (
                  <li key={l.lineId}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm">{l.category.name}</p>
                      <p className={`num text-xs ${l.health === "over" ? "text-neg" : l.health === "warning" ? "text-warn" : "text-ink2"}`}>
                        {money(l.spentCents, budget.currency, { noCents: true })} / {money(l.limitCents, budget.currency, { noCents: true })}
                      </p>
                    </div>
                    <Progress value={Math.min(100, l.percentUsed)} tone={l.health === "over" ? "neg" : l.health === "warning" ? "warn" : "pos"} label={`${l.category.name} budget used`} className="mt-1.5" />
                  </li>
                ))}
            </ul>
          )}
        </Card>
      ),
    },
    goals: {
      size: "half",
      node: (
        <Card
          title="Upcoming goals"
          action={
            <Link href="/app/goals" className="text-xs text-cyan hover:underline">
              All goals
            </Link>
          }
        >
          {goals.length === 0 ? (
            <EmptyState icon={<Target className="size-5" />} title="No goals yet" action={<LinkButton href="/app/goals?new=1" size="sm">Create a goal</LinkButton>} />
          ) : (
            <ul className="space-y-4">
              {goals.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{g.name}</p>
                    <p className="num text-xs text-ink2">{g.projection.percent.toFixed(0)}%</p>
                  </div>
                  <p className="num mb-1.5 text-xs text-ink3">
                    {money(g.savedCents, g.currency, { noCents: true })} / {money(g.targetCents, g.currency, { noCents: true })}
                    {g.targetDate ? ` · by ${shortDate(g.targetDate, { month: "short", year: "numeric" })}` : ""}
                    {g.projection.onTrack === false ? " · behind" : ""}
                  </p>
                  <Progress value={g.projection.percent} tone={g.projection.onTrack === false ? "warn" : "pos"} label={`${g.name} progress`} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ),
    },
    recommendations: {
      size: "full",
      node: (
        <Card
          title="Top AI recommendations"
          action={
            <Link href="/app/advisor" className="text-xs text-cyan hover:underline">
              Ask the advisor
            </Link>
          }
        >
          {insights.length === 0 ? (
            <EmptyState icon={<Sparkles className="size-5" />} title="Nothing needs your attention" body="Recommendations appear when VELTRIX spots something worth reviewing — subscriptions, budgets nearing limits, off-track goals or price drops." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {insights.slice(0, 4).map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          )}
        </Card>
      ),
    },
  };

  // Consecutive half-width widgets share a row.
  const rows: DashboardWidget[][] = [];
  for (const w of layout) {
    const last = rows[rows.length - 1];
    if (widgets[w].size === "half" && last?.length === 1 && widgets[last[0]].size === "half") last.push(w);
    else rows.push([w]);
  }

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="animate-rise">
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[30px]">
            {greeting(user.timezone)}, {firstName}.
          </h1>
          <p className="mt-1.5 text-ink2">
            Here&apos;s your financial overview{insights.length ? ` and ${insights.length} personalized recommendation${insights.length > 1 ? "s" : ""}` : ""}.
            {user.hasDemoData && (
              <span className="ml-2 align-middle">
                <DemoBadge label="Includes demo data" />
              </span>
            )}
          </p>
          <div className="mt-3">
            <DashboardCustomizer layout={layout} />
          </div>
        </div>
        <AdvisorHighlight insight={insights[0] ?? null} />
      </div>

      {!user.onboarded && (
        <Link href="/app/setup" className="panel flex items-center gap-4 border-blue/40 p-4 transition hover:border-blue">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-blue/10 text-cyan">
            <Wallet className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block font-medium">Finish your guided setup</span>
            <span className="block text-sm text-ink2">Add your income, monthly bills and a goal so your plan and budget are accurate.</span>
          </span>
          <ArrowRight className="size-5 text-cyan" aria-hidden />
        </Link>
      )}

      {layout.length === 0 && <EmptyState title="Your dashboard is empty" body="Use Customize to choose what to show, or ask the advisor to “show my goals on my dashboard”." />}
      {rows.map((row) =>
        row.length === 2 ? (
          <div key={row.join("-")} className="grid gap-4 xl:grid-cols-2">
            {widgets[row[0]].node}
            {widgets[row[1]].node}
          </div>
        ) : (
          <div key={row[0]}>{widgets[row[0]].node}</div>
        ),
      )}
      <p className="flex items-center gap-2 text-[11px] text-ink3">
        <ArrowLeftRight className="size-3" aria-hidden /> Figures are calculated from the accounts and transactions in VELTRIX. Information only — not financial advice.
      </p>
    </div>
  );
}

function MonthlyPlan({ currency: c, incomeCents, budgetedCents, goalSavingCents, spentCents }: { currency: string; incomeCents: number | null; budgetedCents: number | null; goalSavingCents: number; spentCents: number }) {
  if (incomeCents === null) {
    return (
      <Card title="Monthly plan">
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="Add your monthly income"
          body="With your take-home pay, VELTRIX shows what's left after your budget and goal saving."
          action={
            <LinkButton href={`/app/advisor?q=${encodeURIComponent("I make $ a month")}`} size="sm">
              Tell the advisor
            </LinkButton>
          }
        />
      </Card>
    );
  }
  const planned = budgetedCents ?? 0;
  const left = incomeCents - planned - goalSavingCents;
  const parts = [
    { label: "Take-home income", value: incomeCents, tone: "text-pos" },
    { label: "Budgeted spending", value: -planned, tone: "text-ink", note: budgetedCents === null ? "No budget yet" : `${money(spentCents, c, { noCents: true })} spent so far` },
    { label: "Goal saving", value: -goalSavingCents, tone: "text-ink", note: goalSavingCents ? "Planned monthly amounts" : "No monthly amounts set" },
  ];
  return (
    <Card
      title="Monthly plan"
      action={
        <Link href="/app/advisor" className="text-xs text-cyan hover:underline">
          Adjust with the advisor
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        {parts.map((p) => (
          <div key={p.label}>
            <p className="text-xs text-ink3">{p.label}</p>
            <p className={`num mt-1 text-lg font-semibold ${p.tone}`}>{money(p.value, c, { noCents: true })}</p>
            {p.note && <p className="text-[11px] text-ink3">{p.note}</p>}
          </div>
        ))}
        <div>
          <p className="text-xs text-ink3">Left over</p>
          <p className={`num mt-1 text-lg font-semibold ${left < 0 ? "text-neg" : "text-cyan"}`}>{money(left, c, { noCents: true })}</p>
          <p className="text-[11px] text-ink3">{left < 0 ? "Plan exceeds income" : "Unplanned each month"}</p>
        </div>
      </div>
      {incomeCents > 0 && (
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/5" role="img" aria-label={`Budget ${Math.round((planned / incomeCents) * 100)}% and goals ${Math.round((goalSavingCents / incomeCents) * 100)}% of income`}>
          <span className="bg-blue" style={{ width: `${Math.min(100, (planned / incomeCents) * 100)}%` }} />
          <span className="bg-violet" style={{ width: `${Math.max(0, Math.min(100 - (planned / incomeCents) * 100, (goalSavingCents / incomeCents) * 100))}%` }} />
        </div>
      )}
    </Card>
  );
}
