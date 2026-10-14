"use client";

import Link from "next/link";
import { useState } from "react";
import { ChartLine } from "lucide-react";
import { Card, DemoBadge, EmptyState, Segmented, Spinner } from "@/components/ui";
import { AreaTrend } from "@/components/charts";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export interface PerformanceData {
  points: { date: string; marketValueCents: number; netContributionsCents: number }[];
  result: { startValueCents: number; endValueCents: number; valueChangeCents: number; netContributionsCents: number; marketGainCents: number; returnPercent: number | null } | null;
  isDemo: boolean;
}

type Range = "1M" | "3M" | "6M" | "1Y" | "5Y";

export function PerformanceCard({ initial, initialRange = "1Y", currency = "USD", title = "Investment performance" }: { initial: PerformanceData; initialRange?: Range; currency?: string; title?: string }) {
  const [range, setRange] = useState<Range>(initialRange);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const r = data.result;
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {title} {data.isDemo && <DemoBadge />}
        </span>
      }
      action={
        <div className="flex items-center gap-2">
          {loading && <Spinner className="size-4" />}
          <Segmented
            size="sm"
            label="Performance range"
            value={range}
            onChange={async (v) => {
              setRange(v);
              setLoading(true);
              try {
                setData(await api<PerformanceData>(`/api/portfolio/performance?range=${v}`));
              } finally {
                setLoading(false);
              }
            }}
            options={(["1M", "3M", "6M", "1Y", "5Y"] as const).map((v) => ({ value: v, label: v }))}
          />
        </div>
      }
    >
      {data.points.length < 2 || !r ? (
        <EmptyState icon={<ChartLine className="size-5" />} title="No portfolio history yet" body="Performance appears once at least two portfolio snapshots exist for this period." action={<Link className="text-sm text-cyan hover:underline" href="/app/investments">Open investments</Link>} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className={`num font-display text-3xl font-semibold ${r.marketGainCents >= 0 ? "text-pos" : "text-neg"}`}>
                {r.returnPercent === null ? "—" : `${r.returnPercent > 0 ? "+" : ""}${r.returnPercent.toFixed(1)}%`}
              </p>
              <p className="text-xs text-ink3">Investment return ({range}), contributions excluded</p>
            </div>
            <dl className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <dt className="text-ink3">Market gain</dt>
                <dd className="num text-ink">{money(r.marketGainCents, currency, { showSign: true, noCents: true })}</dd>
              </div>
              <div>
                <dt className="text-ink3">Contributions</dt>
                <dd className="num text-ink">{money(r.netContributionsCents, currency, { showSign: true, noCents: true })}</dd>
              </div>
              <div>
                <dt className="text-ink3">Value change</dt>
                <dd className="num text-ink">{money(r.valueChangeCents, currency, { showSign: true, noCents: true })}</dd>
              </div>
            </dl>
          </div>
          <AreaTrend
            data={data.points.map((p) => ({ date: p.date, value: p.marketValueCents, contributions: p.netContributionsCents }))}
            color="#26D9A0"
            currency={currency}
            valueLabel="Account value"
            compareKey="contributions"
            compareLabel="Net contributions"
            height={190}
          />
          <p className="mt-2 text-[11px] text-ink3">Dashed line: money you put in. The gap between the lines is market gain or loss, not new savings.</p>
        </>
      )}
    </Card>
  );
}
