"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@veltrix/shared";

const AXIS = { stroke: "#647896", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = "rgba(148,167,197,0.08)";
const SURFACE = "#0D1B31";

function TooltipBox({ title, rows }: { title?: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="glass rounded-[10px] px-3 py-2 text-xs shadow-xl">
      {title && <p className="mb-1 text-ink2">{title}</p>}
      {rows.map((r) => (
        <p key={r.label} className="num flex items-center gap-2 text-ink">
          {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-ink2">{r.label}</span>
          <span className="ml-auto pl-3 font-medium">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export interface DonutSlice {
  key: string;
  name: string;
  value: number;
  color: string;
}

export function DonutChart({ slices, currency = "USD", centerValue, centerLabel, size = 180, onSelect, selected }: { slices: DonutSlice[]; currency?: string; centerValue: string; centerLabel: string; size?: number; onSelect?: (key: string) => void; selected?: string | null }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke={SURFACE}
            strokeWidth={2}
            isAnimationActive={false}
            onClick={(d: { key?: string }) => d.key && onSelect?.(d.key)}
            cursor={onSelect ? "pointer" : undefined}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} opacity={selected && selected !== s.key ? 0.35 : 1} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? <TooltipBox rows={[{ label: String(payload[0].name), value: formatMoney(Number(payload[0].value), currency), color: (payload[0].payload as DonutSlice).color }]} /> : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="num font-display text-xl font-semibold text-ink">{centerValue}</p>
          <p className="text-[11px] text-ink3">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function AreaTrend({
  data,
  color = "#26D9A0",
  height = 180,
  currency = "USD",
  valueKey = "value",
  showAxis = true,
  compareKey,
  compareLabel,
  valueLabel = "Value",
}: {
  data: Record<string, number | string>[];
  color?: string;
  height?: number;
  currency?: string;
  valueKey?: string;
  showAxis?: boolean;
  compareKey?: string;
  compareLabel?: string;
  valueLabel?: string;
}) {
  const gid = `g${color.replace("#", "")}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          {showAxis && <XAxis dataKey="date" {...AXIS} minTickGap={40} tickFormatter={(d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: d.length > 7 ? "numeric" : undefined, timeZone: "UTC" })} />}
          {showAxis && <YAxis {...AXIS} width={56} tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })} domain={["auto", "auto"]} />}
          <Tooltip
            cursor={{ stroke: "rgba(148,167,197,.35)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={String(label)}
                  rows={payload.map((p) => ({ label: p.dataKey === compareKey ? compareLabel ?? "Compare" : valueLabel, value: formatMoney(Number(p.value), currency), color: p.dataKey === compareKey ? "#94A7C5" : color }))}
                />
              ) : null
            }
          />
          {compareKey && <Area type="monotone" dataKey={compareKey} stroke="#94A7C5" strokeDasharray="4 4" strokeWidth={1.5} fill="none" isAnimationActive={false} />}
          <Area type="monotone" dataKey={valueKey} stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriceLine({ data, height = 260, currency = "USD", color = "#39D9FF" }: { data: { date: string; close: number }[]; height?: number; currency?: string; color?: string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" {...AXIS} minTickGap={50} tickFormatter={(d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })} />
          <YAxis {...AXIS} width={56} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(0)} />
          <Tooltip
            cursor={{ stroke: "rgba(148,167,197,.35)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => (active && payload?.[0] ? <TooltipBox title={String(label)} rows={[{ label: "Close", value: formatMoney(Math.round(Number(payload[0].value) * 100), currency), color }]} /> : null)}
          />
          <Line type="monotone" dataKey="close" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashflowBars({ data, currency = "USD", height = 240 }: { data: { label: string; incomeCents: number; spendingCents: number }[]; currency?: string; height?: number }) {
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-ink2" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#3B82F6]" /> Income
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#8F72F0]" /> Spending
        </span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} width={56} tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })} />
            <Tooltip
              cursor={{ fill: "rgba(148,167,197,.06)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(label)}
                    rows={[
                      { label: "Income", value: formatMoney(Number(payload[0]?.value ?? 0), currency), color: "#3B82F6" },
                      { label: "Spending", value: formatMoney(Number(payload[1]?.value ?? 0), currency), color: "#8F72F0" },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="incomeCents" name="Income" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="spendingCents" name="Spending" fill="#8F72F0" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HorizontalBars({ data, currency = "USD" }: { data: { label: string; value: number; color: string }[]; currency?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-ink2">{d.label}</span>
          <span className="h-2 rounded-r-[4px] bg-white/[0.04]">
            <span className="block h-full rounded-r-[4px]" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} title={formatMoney(d.value, currency)} />
          </span>
          <span className="num text-ink">{formatMoney(d.value, currency, { noCents: true })}</span>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ values, color = "#26D9A0", height = 36 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={["auto", "auto"]} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
