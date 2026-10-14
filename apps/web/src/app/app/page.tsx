import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftRight, Landmark, Puzzle, Sparkles, Target, Upload } from "lucide-react";
import { requireUser } from "@/server/current-user";
import { db } from "@/server/db";
import { dashboardSummary, spendingOverview } from "@/server/services/dashboard";
import { performance } from "@/server/services/investments";
import { listInsights, refreshInsights } from "@/server/services/insights";
import { listGoals } from "@/server/services/goals";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SpendingCard } from "@/components/dashboard/spending-card";
import { PerformanceCard } from "@/components/dashboard/performance-card";
import { AdvisorHighlight, InsightCard } from "@/components/dashboard/insight-card";
import { Card, DemoBadge, EmptyState, LinkButton, Progress } from "@/components/ui";
import { money, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Home" };

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
          <p className="mt-1 text-ink2">Let&apos;s set up your financial picture. Everything below is calculated from the records you add.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Landmark, title: "Connect your bank", body: "Link accounts securely through Plaid, or add balances manually. Balances drive your net worth.", href: "/app/overview", cta: "Add accounts" },
            { icon: Upload, title: "Import transactions", body: "Upload a CSV export from your bank. Duplicates are detected automatically.", href: "/app/transactions?import=1", cta: "Import CSV" },
            { icon: Target, title: "Set a goal", body: "Emergency fund, vacation, a home deposit — track progress and the monthly amount needed.", href: "/app/goals?new=1", cta: "Create goal" },
            { icon: Puzzle, title: "Connect the extension", body: "Analyze product pages and save findings to your account while you browse.", href: "/app/settings#extension", cta: "Set up extension" },
          ].map(({ icon: Icon, title, body, href, cta }) => (
            <div key={title} className="panel flex flex-col p-5">
              <span className="mb-3 grid size-10 place-items-center rounded-[12px] bg-blue/10 text-cyan">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 flex-1 text-sm text-ink2">{body}</p>
              <LinkButton href={href} variant="secondary" size="sm" className="mt-4 self-start">
                {cta}
              </LinkButton>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const latest = await db.financialInsight.findFirst({ where: { userId: user.id }, orderBy: { generatedAt: "desc" }, select: { generatedAt: true } });
  if (!latest || Date.now() - latest.generatedAt.getTime() > 60 * 60 * 1000) await refreshInsights(user.id, user.timezone, user.baseCurrency);

  const [summary, spending, perf, insights, goals] = await Promise.all([
    dashboardSummary(user.id, user.timezone, user.baseCurrency),
    spendingOverview(user.id, "month", user.timezone, user.baseCurrency),
    performance(user.id, "1Y", user.timezone),
    listInsights(user.id, 8),
    listGoals(user.id, user.timezone),
  ]);
  const c = user.baseCurrency;
  const nwSpark = summary.history.slice(-60).map((p) => p.netWorthCents);

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
        </div>
        <AdvisorHighlight insight={insights[0] ?? null} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total net worth" value={money(summary.netWorth.cents, c)} change={summary.netWorth.changePercent} comparison={summary.netWorth.comparisonLabel} href="/app/overview" spark={nwSpark} sparkColor="#26D9A0" note={summary.netWorth.excludedForeignCurrency ? `${summary.netWorth.excludedForeignCurrency} foreign-currency account(s) not included` : undefined} />
        <MetricCard label="Monthly spending" value={money(summary.monthlySpending.cents, c)} change={summary.monthlySpending.changePercent} goodWhen="down" comparison={summary.monthlySpending.comparisonLabel} href="/app/transactions" />
        <MetricCard label="Total savings" value={money(summary.savings.cents, c)} change={summary.savings.changePercent} comparison={summary.savings.comparisonLabel} href="/app/savings" note={summary.savings.accountCount ? undefined : "Add a savings account to track this"} />
        <MetricCard label="Investments" value={money(summary.investments.cents, c)} change={summary.investments.changePercent} comparison={summary.investments.comparisonLabel} href="/app/investments" note={summary.investments.accountCount ? "Includes contributions — see return below" : "Add an investment account to track this"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SpendingCard initial={spending} />
        <PerformanceCard initial={perf} currency={c} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
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
      </div>
      <p className="flex items-center gap-2 text-[11px] text-ink3">
        <ArrowLeftRight className="size-3" aria-hidden /> Figures are calculated from the accounts and transactions in VELTRIX. Information only — not financial advice.
      </p>
    </div>
  );
}
