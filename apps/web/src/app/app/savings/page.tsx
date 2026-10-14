import { requireUser } from "@/server/current-user";
import { listAccounts } from "@/server/services/accounts";
import { listRecurring, refreshRecurring } from "@/server/services/recurring";
import { txnsForRange } from "@/server/services/transactions";
import { listGoals } from "@/server/services/goals";
import { addMonths, monthStart, todayIn } from "@/server/dates";
import { monthlyCashflow } from "@veltrix/shared";
import { Card, Progress } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { RecurringList } from "@/components/savings/recurring-list";
import { StrategyCompare } from "@/components/savings/strategy-compare";
import { money, monthLabel } from "@/lib/format";

export const metadata = { title: "Savings" };

const ESSENTIAL = new Set(["housing", "utilities", "food", "transport", "health"]);

export default async function SavingsPage() {
  const user = await requireUser();
  const c = user.baseCurrency;
  const today = todayIn(user.timezone);
  const ym = today.slice(0, 7);
  await refreshRecurring(user.id, user.timezone);
  const [accounts, recurring, last3, goals] = await Promise.all([
    listAccounts(user.id),
    listRecurring(user.id),
    txnsForRange(user.id, monthStart(addMonths(ym, -3)), monthStart(ym), c),
    listGoals(user.id, user.timezone),
  ]);
  const savingsAccounts = accounts.filter((a) => a.type === "SAVINGS" && a.currency === c);
  const savingsTotal = savingsAccounts.reduce((s, a) => s + a.balanceCents, 0);
  const liquid = accounts.filter((a) => ["CHECKING", "SAVINGS", "CASH"].includes(a.type) && a.currency === c).reduce((s, a) => s + a.balanceCents, 0);
  const essentialMonthly = Math.round(last3.filter((t) => t.amountCents < 0 && ESSENTIAL.has(t.categorySlug ?? "")).reduce((s, t) => s - t.amountCents, 0) / 3);
  const cf = monthlyCashflow(last3);
  const rates = cf.map((m) => m.savingsRate).filter((r): r is number => r !== null);
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const reducible = recurring.filter((r) => r.status === "SUSPECTED" && r.frequency === "MONTHLY").reduce((s, r) => s + r.amountCents, 0);
  const subsAnnual = recurring.filter((r) => r.status !== "DISMISSED").reduce((s, r) => s + r.estimatedAnnualCents, 0);
  const ef = goals.find((g) => g.kind === "EMERGENCY_FUND");
  const coverage = essentialMonthly > 0 ? liquid / essentialMonthly : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Savings" description="What you've set aside, how fast you're saving, and recurring costs worth reviewing." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Savings balances">
          <p className="num font-display text-3xl font-semibold">{money(savingsTotal, c)}</p>
          <ul className="mt-3 space-y-1 text-sm text-ink2">
            {savingsAccounts.length === 0 ? <li>No savings accounts yet.</li> : savingsAccounts.map((a) => <li key={a.id} className="flex justify-between"><span>{a.name}</span><span className="num text-ink">{money(a.balanceCents, a.currency)}</span></li>)}
          </ul>
        </Card>
        <Card title="Savings rate">
          <p className="num font-display text-3xl font-semibold">{avgRate === null ? "—" : `${avgRate.toFixed(1)}%`}</p>
          <p className="text-xs text-ink3">Average of the last {rates.length || 3} full months: (income − spending) ÷ income</p>
          <ul className="mt-3 space-y-1 text-sm">
            {cf.map((m) => (
              <li key={m.month} className="flex justify-between text-ink2">
                <span>{monthLabel(m.month, "long")}</span>
                <span className="num text-ink">{m.savingsRate === null ? "no income" : `${m.savingsRate.toFixed(1)}%`}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Emergency fund">
          {coverage === null ? (
            <p className="text-sm text-ink2">Add a few months of transactions so VELTRIX can estimate your essential spending.</p>
          ) : (
            <>
              <p className="num font-display text-3xl font-semibold">{coverage.toFixed(1)} months</p>
              <p className="text-xs text-ink3">Cash ({money(liquid, c, { noCents: true })}) ÷ essential spending ({money(essentialMonthly, c, { noCents: true })}/mo)</p>
              <Progress className="mt-3" value={(coverage / 6) * 100} tone={coverage >= 3 ? "pos" : "warn"} label="Emergency fund coverage of 6 months" />
              <div className="mt-2 flex justify-between text-[11px] text-ink3">
                <span>3 months: {money(essentialMonthly * 3, c, { noCents: true })}</span>
                <span>6 months: {money(essentialMonthly * 6, c, { noCents: true })}</span>
              </div>
              <p className="mt-3 text-xs text-ink2">{ef ? `Your "${ef.name}" goal is ${ef.projection.percent.toFixed(0)}% funded.` : <a className="text-cyan hover:underline" href="/app/goals?new=EMERGENCY_FUND">Create an emergency fund goal</a>}</p>
            </>
          )}
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card id="subscriptions" title={`Recurring payments · ~${money(subsAnnual, c, { noCents: true })}/yr`}>
          <RecurringList items={recurring} />
        </Card>
        <Card title="Compare savings strategies">
          <StrategyCompare defaultTargetCents={ef?.targetCents ?? (essentialMonthly * 6 || 1000000)} savedCents={ef?.savedCents ?? 0} reducibleMonthlyCents={reducible} />
        </Card>
      </div>
    </div>
  );
}
