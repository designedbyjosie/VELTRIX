import { requireUser } from "@/server/current-user";
import { buildReport } from "@/server/services/reports";
import { SYSTEM_CATEGORIES } from "@veltrix/shared";
import { Card, Badge } from "@/components/ui";
import { AreaTrend, CashflowBars, HorizontalBars } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { DownloadReportCsv, ExportLinks, ReportPeriod } from "@/components/reports/report-actions";
import { groupColor } from "@/lib/colors";
import { money, monthLabel } from "@/lib/format";

export const metadata = { title: "Reports" };

const NAMES: Record<string, string> = Object.fromEntries(SYSTEM_CATEGORIES.map((c) => [c.slug, c.name]));

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireUser();
  const period = (await searchParams).period === "yearly" ? "yearly" : "monthly";
  const r = await buildReport(user.id, period, user.timezone, user.baseCurrency);
  const c = r.currency;
  const label = (m: string) => (period === "monthly" ? monthLabel(m) : m);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Income, spending, savings rate, net worth, debt, budgets and investments — calculated from your records."
        actions={
          <>
            <ReportPeriod period={period} />
            <DownloadReportCsv rows={r.rows} filename={`veltrix-${period}-report.csv`} />
            <ExportLinks />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Income", v: money(r.totals.incomeCents, c) },
          { l: "Spending", v: money(r.totals.spendingCents, c) },
          { l: "Net cash flow", v: money(r.totals.netCents, c, { showSign: true }), tone: r.totals.netCents >= 0 ? "text-pos" : "text-neg" },
          { l: "Savings rate", v: r.totals.savingsRate === null ? "—" : `${r.totals.savingsRate}%` },
        ].map((s) => (
          <div key={s.l} className="panel p-4">
            <p className="text-[13px] text-ink2">{s.l}</p>
            <p className={`num mt-1 font-display text-2xl font-semibold ${s.tone ?? ""}`}>{s.v}</p>
            <p className="text-xs text-ink3">{period === "monthly" ? "Last 12 months" : "Last 3 years"}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Cash flow">
          <CashflowBars data={r.rows.map((x) => ({ label: label(x.month), incomeCents: x.incomeCents, spendingCents: x.spendingCents }))} currency={c} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Cash flow by period</caption>
              <thead className="text-left text-xs text-ink3">
                <tr className="border-b border-line-soft">
                  <th className="py-2 font-medium">Period</th>
                  <th className="py-2 text-right font-medium">Income</th>
                  <th className="py-2 text-right font-medium">Spending</th>
                  <th className="py-2 text-right font-medium">Net</th>
                  <th className="py-2 text-right font-medium">Savings rate</th>
                </tr>
              </thead>
              <tbody>
                {[...r.rows].reverse().map((x) => (
                  <tr key={x.month} className="border-b border-line-soft/60">
                    <td className="py-1.5">{period === "monthly" ? monthLabel(x.month, "long") : x.month}</td>
                    <td className="num py-1.5 text-right">{money(x.incomeCents, c, { noCents: true })}</td>
                    <td className="num py-1.5 text-right">{money(x.spendingCents, c, { noCents: true })}</td>
                    <td className={`num py-1.5 text-right ${x.netCents >= 0 ? "text-pos" : "text-neg"}`}>{money(x.netCents, c, { showSign: true, noCents: true })}</td>
                    <td className="num py-1.5 text-right text-ink2">{x.savingsRate === null ? "—" : `${x.savingsRate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Spending by category">
            {r.categories.length ? <HorizontalBars currency={c} data={r.categories.map((s) => ({ label: s.group === "other" ? "Other" : NAMES[s.group] ?? s.group, value: s.totalCents, color: groupColor(s.group) }))} /> : <p className="text-sm text-ink2">No spending recorded.</p>}
          </Card>
          <Card title="Budget adherence (last 6 months)">
            <ul className="space-y-1.5 text-sm">
              {r.adherence.map((a) => (
                <li key={a.month} className="flex justify-between">
                  <span className="text-ink2">{monthLabel(a.month, "long")}</span>
                  <span className="num">{a.percentWithin === null ? <span className="text-ink3">no budget</span> : `${a.withinLimit}/${a.lines} categories within limit`}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Net worth">
          <p className="num font-display text-2xl font-semibold">{money(r.netWorth.current.netWorthCents, c)}</p>
          {r.netWorth.history.length > 1 ? <AreaTrend data={r.netWorth.history.map((h) => ({ date: h.date, value: h.netWorthCents }))} color="#39D9FF" currency={c} height={160} valueLabel="Net worth" /> : <p className="mt-2 text-sm text-ink2">Not enough balance history yet.</p>}
        </Card>
        <Card title="Debt">
          {r.debts.length === 0 ? (
            <p className="text-sm text-ink2">No liabilities recorded.</p>
          ) : (
            <>
              <p className="num font-display text-2xl font-semibold text-neg">{money(r.netWorth.current.liabilitiesCents, c)}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {r.debts.map((d) => (
                  <li key={d.name} className="flex justify-between">
                    <span className="text-ink2">
                      {d.name} <Badge>{d.type.replace(/_/g, " ").toLowerCase()}</Badge>
                    </span>
                    <span className="num">{money(d.balanceCents, d.currency)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Card title="Investment performance (1Y)">
          {r.investment.result ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink2">Return (excl. contributions)</dt><dd className="num font-semibold">{r.investment.result.returnPercent ?? "—"}%</dd></div>
              <div className="flex justify-between"><dt className="text-ink2">Market gain</dt><dd className="num">{money(r.investment.result.marketGainCents, c, { showSign: true })}</dd></div>
              <div className="flex justify-between"><dt className="text-ink2">Net contributions</dt><dd className="num">{money(r.investment.result.netContributionsCents, c, { showSign: true })}</dd></div>
              <div className="flex justify-between"><dt className="text-ink2">Value change</dt><dd className="num">{money(r.investment.result.valueChangeCents, c, { showSign: true })}</dd></div>
              {r.investment.isDemo && <p className="text-[11px] text-[#FFCF85]">Includes demo data.</p>}
            </dl>
          ) : (
            <p className="text-sm text-ink2">Needs at least two portfolio snapshots in the last year.</p>
          )}
        </Card>
      </div>
      <p className="text-[11px] text-ink3">Generated {new Date(r.generatedAt).toLocaleString()} · base currency {c}. Transfers between your accounts are excluded from income and spending.</p>
    </div>
  );
}
