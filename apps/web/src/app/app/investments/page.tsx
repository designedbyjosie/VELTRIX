import { TriangleAlert } from "lucide-react";
import { requireUser } from "@/server/current-user";
import { checkAlerts, getPortfolio, performance } from "@/server/services/investments";
import { listAccounts } from "@/server/services/accounts";
import { Card, DemoBadge, Badge } from "@/components/ui";
import { HorizontalBars } from "@/components/charts";
import { PerformanceCard } from "@/components/dashboard/performance-card";
import { Holdings } from "@/components/investments/holdings";
import { PageHeader } from "@/components/page-header";
import { money } from "@/lib/format";

export const metadata = { title: "Investments" };

const ALLOC_COLORS = ["#3B82F6", "#D96A26", "#1798BD", "#D55181", "#C98500", "#8F72F0", "#16A06C", "#5D7290"];

export default async function InvestmentsPage() {
  const user = await requireUser();
  const c = user.baseCurrency;
  await checkAlerts(user.id);
  const [p, perf, accounts] = await Promise.all([getPortfolio(user.id), performance(user.id, "1Y", user.timezone), listAccounts(user.id)]);
  const s = p.summary;
  const investAccounts = accounts.filter((a) => a.type === "INVESTMENT" || a.type === "RETIREMENT");
  const concentrationCopy = {
    diversified: "Holdings are spread out; no single position dominates.",
    moderate: "Some concentration: a few positions make up much of the value.",
    concentrated: "Highly concentrated: a large share of value depends on one or two positions.",
  }[s.concentrationLevel];
  return (
    <div className="space-y-5">
      <PageHeader title="Investments" description="Holdings, allocation and risk indicators. Unrealized gains aren't profit until you sell." />
      {p.dataSource.isDemo && p.holdings.length > 0 && (
        <p className="flex items-start gap-2 rounded-[12px] border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-[#FFCF85]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Prices come from VELTRIX&apos;s simulated demo feed, not real markets. Configure a market data provider to value real holdings.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Market value", value: money(s.marketValueCents, c) },
          { label: "Cost basis", value: money(s.costBasisCents, c) },
          { label: "Unrealized gain", value: money(s.unrealizedGainCents, c, { showSign: true }), sub: s.unrealizedGainPercent !== null ? `${s.unrealizedGainPercent > 0 ? "+" : ""}${s.unrealizedGainPercent}% on cost` : undefined, tone: s.unrealizedGainCents >= 0 ? "text-pos" : "text-neg" },
          { label: "Largest position", value: `${s.largestPositionPercent}%`, sub: `of portfolio · HHI ${s.concentrationHHI.toLocaleString()}` },
        ].map((m) => (
          <div key={m.label} className="panel p-4">
            <p className="text-[13px] text-ink2">{m.label}</p>
            <p className={`num mt-1 font-display text-2xl font-semibold ${m.tone ?? ""}`}>{m.value}</p>
            {m.sub && <p className="text-xs text-ink3">{m.sub}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <PerformanceCard initial={perf} currency={c} title="Portfolio performance" />
        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2">Allocation by type {p.dataSource.isDemo && p.holdings.length > 0 && <DemoBadge label="Demo prices" />}</span>}>
            {s.allocation.length ? <HorizontalBars currency={c} data={s.allocation.map((a, i) => ({ label: `${a.key} · ${a.percent}%`, value: a.valueCents, color: ALLOC_COLORS[i % 8] }))} /> : <p className="text-sm text-ink2">Add holdings to see allocation.</p>}
          </Card>
          <Card title="Sector exposure">
            {p.bySector.length ? <HorizontalBars currency={c} data={p.bySector.map((a, i) => ({ label: `${a.key} · ${a.percent}%`, value: a.valueCents, color: ALLOC_COLORS[i % 8] }))} /> : <p className="text-sm text-ink2">No sector data yet.</p>}
          </Card>
          <Card title="Diversification">
            <p className="flex items-center gap-2 text-sm">
              <Badge tone={s.concentrationLevel === "diversified" ? "pos" : s.concentrationLevel === "moderate" ? "warn" : "neg"}>{s.concentrationLevel}</Badge>
              <span className="text-ink2">{concentrationCopy}</span>
            </p>
            <p className="mt-2 text-[11px] text-ink3">Measured with the Herfindahl–Hirschman index of position weights (under 1,500 diversified; over 2,500 concentrated). Index funds count as one position here, even though they hold many companies.</p>
          </Card>
        </div>
      </div>
      <Holdings holdings={p.holdings} accounts={investAccounts.map((a) => ({ id: a.id, name: a.name }))} currency={c} />
      <p className="text-[11px] text-ink3">Price source: {p.dataSource.label}. {p.unpricedCount ? `${p.unpricedCount} holding(s) have no available price and are excluded from totals.` : ""} VELTRIX does not execute trades.</p>
    </div>
  );
}
