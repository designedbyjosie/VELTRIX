"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, Input } from "@/components/ui";
import { money } from "@/lib/format";

export type FigureSource = "bank" | "imported" | "entered" | "budget" | "estimated" | "missing";
export interface Figure {
  cents: number | null;
  source: FigureSource;
  basis: string;
  asOf: string | null;
  stale: boolean;
}

const SOURCE: Record<FigureSource, { label: string; tone: "pos" | "info" | "violet" | "neutral" | "warn" | "neg" }> = {
  bank: { label: "Bank sync", tone: "pos" },
  imported: { label: "Your transactions", tone: "info" },
  entered: { label: "You entered", tone: "violet" },
  budget: { label: "From your budget", tone: "neutral" },
  estimated: { label: "Calculated", tone: "warn" },
  missing: { label: "Missing", tone: "neg" },
};

export function SourceBadge({ source, stale }: { source: FigureSource; stale?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={SOURCE[source].tone}>{SOURCE[source].label}</Badge>
      {stale && <Badge tone="warn">Out of date</Badge>}
    </span>
  );
}

/** A labeled figure with its source and an expandable explanation. */
export function FigureTile({ label, figure, currency, suffix, emphasis, emptyText = "Unknown" }: { label: string; figure: Figure; currency: string; suffix?: string; emphasis?: boolean; emptyText?: string }) {
  return (
    <div className="panel-inner flex flex-col gap-1.5 p-4">
      <p className="text-xs text-ink3">{label}</p>
      <p className={`num font-display font-semibold ${emphasis ? "text-2xl" : "text-xl"} ${figure.cents === null ? "text-ink3" : figure.cents < 0 ? "text-neg" : "text-ink"}`}>
        {figure.cents === null ? emptyText : money(figure.cents, currency, { noCents: true })}
        {figure.cents !== null && suffix ? <span className="ml-1 text-xs font-normal text-ink3">{suffix}</span> : null}
      </p>
      <SourceBadge source={figure.source} stale={figure.stale} />
      <Explain summary="How is this calculated?">
        <p>{figure.basis}</p>
        {figure.asOf && <p className="mt-1 text-ink3">As of {new Date(figure.asOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
      </Explain>
    </div>
  );
}

/** Keyboard-accessible disclosure for evidence and assumptions. */
export function Explain({ summary, children, defaultOpen }: { summary: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group text-xs text-ink2" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1 text-cyan hover:underline [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3 transition group-open:rotate-180" aria-hidden />
        {summary}
      </summary>
      <div className="mt-1.5 rounded-[8px] bg-bg2/70 p-2.5 leading-relaxed">{children}</div>
    </details>
  );
}

/** Dollar input that reports whole cents (or null when empty/invalid). */
export function DollarInput({ id, value, onChange, placeholder = "0", ariaLabel, allowNegative }: { id: string; value: string; onChange: (raw: string) => void; placeholder?: string; ariaLabel?: string; allowNegative?: boolean }) {
  const invalid = value.trim() !== "" && toCents(value, allowNegative) === null;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink3">$</span>
      <Input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel} aria-invalid={invalid || undefined} className="num pl-7" />
    </div>
  );
}

export function toCents(raw: string, allowNegative = false): number | null {
  const v = raw.replace(/[$,\s]/g, "");
  if (!v) return null;
  const re = allowNegative ? /^-?\d{1,11}(\.\d{1,2})?$/ : /^\d{1,11}(\.\d{1,2})?$/;
  if (!re.test(v)) return null;
  return Math.round(Number(v) * 100);
}

/** "2026-10" + 3 → "Jan 2027" */
export function monthName(startYm: string, offset: number) {
  const [y, m] = startYm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function deltaText(cents: number, currency: string) {
  if (cents === 0) return "No change";
  return `${cents > 0 ? "+" : "−"}${money(Math.abs(cents), currency, { noCents: true })}`;
}

export function monthsText(n: number) {
  return `${n} month${n === 1 ? "" : "s"}`;
}

export const PROJECTION_NOTE = "Projections, not predictions. They use your recent averages and the assumptions shown, and can't foresee events you haven't entered.";
