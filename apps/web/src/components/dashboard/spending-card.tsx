"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Delta, EmptyState, Segmented, Spinner } from "@/components/ui";
import { DonutChart } from "@/components/charts";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { groupColor } from "@/lib/colors";
import { ChartPie } from "lucide-react";

export interface SpendingData {
  range: "month" | "3m" | "12m";
  label: string;
  from: string;
  toExclusive: string;
  currency: string;
  totalCents: number;
  previousTotalCents: number;
  changePercent: number | null;
  comparisonLabel: string;
  slices: { group: string; name: string; totalCents: number; percent: number; count: number; previousCents: number; topMerchants: { merchant: string; cents: number }[] }[];
}


export function SpendingCard({ initial }: { initial: SpendingData }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const change = async (range: SpendingData["range"]) => {
    setLoading(true);
    setSelected(null);
    try {
      setData(await api<SpendingData>(`/api/dashboard/spending?range=${range}`));
    } finally {
      setLoading(false);
    }
  };
  const sel = data.slices.find((s) => s.group === selected);
  return (
    <Card
      title="Spending breakdown"
      action={
        <div className="flex items-center gap-2">
          {loading && <Spinner className="size-4" />}
          <Segmented
            size="sm"
            label="Spending period"
            value={data.range}
            onChange={change}
            options={[
              { value: "month", label: "This month" },
              { value: "3m", label: "3 months" },
              { value: "12m", label: "12 months" },
            ]}
          />
        </div>
      }
    >
      {data.slices.length === 0 ? (
        <EmptyState icon={<ChartPie className="size-5" />} title="No spending recorded for this period" body="Add transactions or import a CSV from your bank to see where your money goes." action={<Link className="text-sm text-cyan hover:underline" href="/app/transactions">Go to transactions</Link>} />
      ) : (
        <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
          <div className="mx-auto">
            <DonutChart
              slices={data.slices.map((s) => ({ key: s.group, name: s.name, value: s.totalCents, color: groupColor(s.group) }))}
              currency={data.currency}
              centerValue={money(data.totalCents, data.currency, { noCents: true })}
              centerLabel={data.range === "month" ? "This month" : data.label}
              onSelect={(k) => setSelected((s) => (s === k ? null : k))}
              selected={selected}
            />
          </div>
          <div>
            <table className="w-full text-[13px]">
              <caption className="sr-only">Spending by category, {data.label}</caption>
              <thead className="sr-only">
                <tr>
                  <th>Category</th>
                  <th>Share</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.slices.map((s) => (
                  <tr key={s.group} className={`cursor-pointer ${selected && selected !== s.group ? "opacity-50" : ""}`} onClick={() => setSelected((x) => (x === s.group ? null : s.group))}>
                    <td className="py-1.5">
                      <button className="flex items-center gap-2 text-left text-ink2 hover:text-ink" aria-pressed={selected === s.group}>
                        <span className="size-2.5 rounded-[3px]" style={{ background: groupColor(s.group) }} />
                        {s.name}
                      </button>
                    </td>
                    <td className="num py-1.5 text-right text-ink3">{s.percent.toFixed(0)}%</td>
                    <td className="num py-1.5 text-right font-medium text-ink">{money(s.totalCents, data.currency, { noCents: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink3">
              <Delta value={data.changePercent} goodWhen="down" /> {data.comparisonLabel} ({money(data.previousTotalCents, data.currency, { noCents: true })})
            </p>
          </div>
        </div>
      )}
      {sel && (
        <div className="panel-inner mt-4 animate-rise p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">{sel.name}</p>
            <Link href={`/app/transactions?from=${data.from}&type=expense`} className="text-xs text-cyan hover:underline">
              View transactions
            </Link>
          </div>
          <p className="mt-1 text-xs text-ink3">
            {sel.count} transactions · previous period {money(sel.previousCents, data.currency)}
          </p>
          <ul className="mt-2 space-y-1">
            {sel.topMerchants.map((m) => (
              <li key={m.merchant} className="flex justify-between text-ink2">
                <span className="truncate">{m.merchant}</span>
                <span className="num text-ink">{money(m.cents, data.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
