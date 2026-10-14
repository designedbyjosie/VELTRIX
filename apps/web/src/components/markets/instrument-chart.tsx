"use client";

import { useState } from "react";
import { PriceLine } from "@/components/charts";
import { Segmented, Spinner } from "@/components/ui";
import { api } from "@/lib/api";

type Range = "1M" | "3M" | "6M" | "1Y" | "5Y";

export function InstrumentChart({ symbol, initial, currency }: { symbol: string; initial: { date: string; close: number }[]; currency: string }) {
  const [range, setRange] = useState<Range>("1Y");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const change = data.length > 1 ? ((data[data.length - 1].close - data[0].close) / data[0].close) * 100 : null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-ink2">
          {range} price change: <span className={`num font-medium ${change !== null && change >= 0 ? "text-pos" : "text-neg"}`}>{change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(2)}%`}</span>
        </p>
        <div className="flex items-center gap-2">
          {loading && <Spinner className="size-4" />}
          <Segmented
            size="sm"
            label="Chart range"
            value={range}
            onChange={async (v) => {
              setRange(v);
              setLoading(true);
              try {
                const r = await api<{ history: { date: string; close: number }[] }>(`/api/markets/${encodeURIComponent(symbol)}?range=${v}`);
                setData(r.history);
              } finally {
                setLoading(false);
              }
            }}
            options={(["1M", "3M", "6M", "1Y", "5Y"] as const).map((v) => ({ value: v, label: v }))}
          />
        </div>
      </div>
      {data.length ? <PriceLine data={data} currency={currency} /> : <p className="py-10 text-center text-sm text-ink2">No price history available from the data source.</p>}
    </div>
  );
}
