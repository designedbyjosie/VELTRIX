"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, CalendarPlus, Car, CreditCard, Home, Percent, PiggyBank, Plane, Save, ShoppingCart, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import type { PlanComparison, PlanSummary, ScenarioChange } from "@veltrix/shared";
import { ProjectionChart } from "@/components/charts";
import { Badge, Button, Card, EmptyState, Field, FormError, Input, Segmented, Select, Spinner, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { deltaText, DollarInput, Explain, monthName, monthsText, PROJECTION_NOTE, toCents } from "./common";

interface SeriesPoint {
  month: number;
  liquidCents: number;
  netWorthCents: number;
  debtCents: number;
}
export interface WhatIfResult {
  startMonth: string;
  canProject: boolean;
  missing: string[];
  assumptions: { annualReturnPct: { best: number; expected: number; adverse: number }; spendingVariancePct: number; emergencyMonths: number };
  baseline: { summary: PlanSummary; series: SeriesPoint[]; best: number[]; adverse: number[] };
  scenario: { summary: PlanSummary; series: SeriesPoint[]; best: number[]; adverse: number[]; bestSummary: PlanSummary; adverseSummary: PlanSummary };
  comparison: PlanComparison;
  drivers: { index: number; label: string; endNetWorthDeltaCents: number; lowestLiquidDeltaCents: number }[];
}

/** Editable form of a change: amounts as text so typing is never fought. */
interface Draft {
  key: number;
  enabled: boolean;
  kind: ScenarioChange["kind"];
  label: string;
  amount: string;
  percent: string;
  month: string;
  duration: string;
  bucket: "essential" | "discretionary";
  apr: string;
  goalId: string;
}

const PRESETS: { id: string; label: string; icon: typeof ShoppingCart; draft: Partial<Draft> }[] = [
  { id: "purchase", label: "Big purchase", icon: ShoppingCart, draft: { kind: "one_time", label: "Big purchase", amount: "1500" } },
  { id: "income_down", label: "Income drops", icon: TrendingDown, draft: { kind: "income", label: "Income drops 15%", percent: "-15", duration: "" } },
  { id: "job_loss", label: "Job loss", icon: Briefcase, draft: { kind: "income", label: "No income for 3 months", percent: "-100", duration: "3" } },
  { id: "raise", label: "Raise", icon: TrendingUp, draft: { kind: "income", label: "Raise", percent: "5", duration: "" } },
  { id: "rent", label: "Rent changes", icon: Home, draft: { kind: "expense", bucket: "essential", label: "Rent goes up", amount: "200", duration: "" } },
  { id: "cut", label: "Spend less", icon: Percent, draft: { kind: "expense", bucket: "discretionary", label: "Cut discretionary 20%", percent: "-20", duration: "" } },
  { id: "save", label: "Save more", icon: PiggyBank, draft: { kind: "extra_saving", label: "Save $200 more a month", amount: "200" } },
  { id: "debt", label: "Extra debt payment", icon: CreditCard, draft: { kind: "extra_debt_payment", label: "Extra $200 to debt", amount: "200" } },
  { id: "vacation", label: "Vacation", icon: Plane, draft: { kind: "one_time", label: "Summer vacation", amount: "2500", month: "6" } },
  { id: "finance", label: "Finance a purchase", icon: Car, draft: { kind: "financed_purchase", label: "Financed purchase", amount: "12000", duration: "48", apr: "7.5" } },
  { id: "delay", label: "Delay a purchase", icon: CalendarPlus, draft: { kind: "one_time", label: "Purchase in 6 months", amount: "1500", month: "6" } },
];

function blank(key: number, d: Partial<Draft>): Draft {
  return { key, enabled: true, kind: "one_time", label: "", amount: "", percent: "", month: "0", duration: "", bucket: "discretionary", apr: "", goalId: "", ...d };
}

/** Draft → API change, or an error message. */
function toChange(d: Draft): ScenarioChange | string {
  const start = Number(d.month || 0);
  if (!Number.isInteger(start) || start < 0 || start > 119) return `${d.label || "A change"}: start month must be 0–119`;
  const months = d.duration.trim() ? Number(d.duration) : null;
  if (months !== null && (!Number.isInteger(months) || months < 1)) return `${d.label}: duration must be a whole number of months`;
  const amt = d.amount.trim() ? toCents(d.amount, true) : undefined;
  if (amt === null) return `${d.label}: check the amount`;
  const pct = d.percent.trim() ? Number(d.percent) : undefined;
  if (pct !== undefined && Number.isNaN(pct)) return `${d.label}: check the percent`;
  const label = d.label.trim() || "Change";
  switch (d.kind) {
    case "one_time":
      if (!amt) return `${label}: enter an amount`;
      return { kind: "one_time", label, amountCents: amt, month: start };
    case "income":
      if (pct === undefined && !amt) return `${label}: enter a percent or amount`;
      return { kind: "income", label, percent: pct, amountCents: amt, startMonth: start, months };
    case "expense":
      if (pct === undefined && !amt) return `${label}: enter a percent or amount`;
      return { kind: "expense", label, bucket: d.bucket, percent: pct, amountCents: amt, startMonth: start, months };
    case "extra_saving":
      if (!amt || amt <= 0) return `${label}: enter a monthly amount`;
      return { kind: "extra_saving", label, amountCents: amt, startMonth: start, goalId: d.goalId || null };
    case "extra_debt_payment":
      if (!amt || amt <= 0) return `${label}: enter a monthly amount`;
      return { kind: "extra_debt_payment", label, amountCents: amt, startMonth: start };
    case "financed_purchase": {
      const apr = Number(d.apr || 0);
      if (!amt || amt <= 0 || !months || Number.isNaN(apr)) return `${label}: enter the amount, months and APR`;
      return { kind: "financed_purchase", label, amountCents: amt, months, aprPercent: apr, startMonth: start };
    }
  }
}

export function WhatIf({ currency, goals, initial }: { currency: string; goals: { id: string; name: string }[]; initial?: string | null }) {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    const preset = PRESETS.find((p) => p.id === initial);
    return preset ? [blank(1, preset.draft)] : [];
  });
  const [horizon, setHorizon] = useState("24");
  const [metric, setMetric] = useState<"cash" | "networth">("cash");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  const built = useMemo(() => drafts.filter((d) => d.enabled).map(toChange), [drafts]);
  const problems = built.filter((b): b is string => typeof b === "string");
  const changes = built.filter((b): b is ScenarioChange => typeof b !== "string");

  useEffect(() => {
    if (problems.length) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api<WhatIfResult>("/api/plan/scenario", { body: { changes, horizonMonths: Number(horizon) } });
        if (id === seq.current) setResult(r);
      } catch (e) {
        if (id === seq.current) setError(e instanceof ApiError ? e.message : "Couldn't run the projection.");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `changes` is derived from drafts
  }, [JSON.stringify(changes), horizon, problems.length]);

  const update = (key: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const add = (p: Partial<Draft>) => setDrafts((ds) => [...ds, blank(Date.now(), p)]);

  const chart = useMemo(() => {
    if (!result) return [];
    const key = metric === "cash" ? "liquidCents" : "netWorthCents";
    return result.scenario.series.map((s, i) => ({
      label: monthName(result.startMonth, s.month),
      scenario: s[key],
      baseline: changes.length ? result.baseline.series[i][key] : undefined,
      range: metric === "cash" ? ([result.scenario.adverse[i], result.scenario.best[i]] as [number, number]) : undefined,
    }));
  }, [result, metric, changes.length]);

  async function save() {
    const name = window.prompt("Name this plan", drafts.filter((d) => d.enabled).map((d) => d.label).join(" + ") || "Current plan");
    if (!name) return;
    setSaving(true);
    try {
      await api("/api/plan/snapshots", { body: { name: name.slice(0, 80), kind: "scenario", changes, horizonMonths: Number(horizon) } });
      toast("Plan saved. Compare it with what actually happens under Saved plans.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save the plan", "neg");
    } finally {
      setSaving(false);
    }
  }

  const s = result?.scenario.summary;
  const b = result?.baseline.summary;
  const c = currency;

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div className="space-y-3">
        <Card title="Add a what-if">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => add(p.draft)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg2 px-3 py-1.5 text-xs text-ink2 transition hover:border-blue hover:text-ink">
                <p.icon className="size-3.5" aria-hidden /> {p.label}
              </button>
            ))}
          </div>
        </Card>
        {drafts.length === 0 && <p className="px-1 text-sm text-ink3">Pick a what-if above. The chart shows your current path until you add one.</p>}
        {drafts.map((d) => (
          <div key={d.key} className={`panel space-y-3 p-4 transition ${d.enabled ? "" : "opacity-55"}`}>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-[#3B82F6]" checked={d.enabled} onChange={(e) => update(d.key, { enabled: e.target.checked })} aria-label={`Include ${d.label}`} />
              <Input value={d.label} onChange={(e) => update(d.key, { label: e.target.value })} aria-label="Name" maxLength={80} className="h-8 flex-1 text-sm font-medium" />
              <Button size="sm" variant="ghost" onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))} aria-label={`Remove ${d.label}`}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <ChangeFields d={d} update={(p) => update(d.key, p)} goals={goals} />
          </div>
        ))}
        {problems.length > 0 && <FormError message={problems[0]} />}
      </div>

      <div className="space-y-4">
        <Card
          title={changes.length ? "Your scenario vs. your current path" : "Your current path"}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Segmented size="sm" label="Metric" value={metric} onChange={setMetric} options={[{ value: "cash", label: "Cash reserves" }, { value: "networth", label: "Net worth" }]} />
              <Select value={horizon} onChange={(e) => setHorizon(e.target.value)} aria-label="Time horizon" className="h-8 w-28 text-xs">
                {["12", "24", "36", "60"].map((h) => (
                  <option key={h} value={h}>
                    {Number(h) / 12} year{h === "12" ? "" : "s"}
                  </option>
                ))}
              </Select>
            </div>
          }
        >
          {!result && loading ? (
            <div className="grid h-[280px] place-items-center">
              <Spinner />
            </div>
          ) : error ? (
            <FormError message={error} />
          ) : result && !result.canProject ? (
            <EmptyState title="Add your income and spending to project the future" body={result.missing.join(" ")} />
          ) : result ? (
            <>
              <div className={loading ? "opacity-60 transition" : "transition"}>
                <ProjectionChart data={chart} currency={c} scenarioLabel={changes.length ? "Scenario (expected)" : "Expected"} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink3">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-cyan" /> {changes.length ? "Scenario" : "Expected"}</span>
                {changes.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-ink2" /> Current path</span>}
                {metric === "cash" && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-blue/25" /> Range if spending runs {result.assumptions.spendingVariancePct}% lower or higher</span>}
              </div>
            </>
          ) : null}
        </Card>

        {result?.canProject && s && b && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label={`Cash in ${monthName(result.startMonth, s.horizonMonths - 1)}`} value={money(s.endLiquidCents, c, { noCents: true })} delta={changes.length ? deltaText(result.comparison.endLiquidDeltaCents, c) : null} good={result.comparison.endLiquidDeltaCents >= 0} />
              <Metric label="Lowest cash point" value={money(s.lowestLiquid.cents, c, { noCents: true })} sub={monthName(result.startMonth, s.lowestLiquid.month)} delta={changes.length ? deltaText(result.comparison.lowestLiquidDeltaCents, c) : null} good={result.comparison.lowestLiquidDeltaCents >= 0} warn={s.firstNegativeMonth !== null} />
              <Metric label={`Net worth in ${monthName(result.startMonth, s.horizonMonths - 1)}`} value={money(s.endNetWorthCents, c, { noCents: true })} delta={changes.length ? deltaText(result.comparison.endNetWorthDeltaCents, c) : null} good={result.comparison.endNetWorthDeltaCents >= 0} />
              <Metric label="Debt-free" value={s.endDebtCents === 0 ? (s.debtFreeMonth === 0 ? "No debt" : monthName(result.startMonth, s.debtFreeMonth ?? 0)) : "Not in this period"} sub={s.totalInterestCents ? `${money(s.totalInterestCents, c, { noCents: true })} interest` : undefined} />
            </div>
            {s.firstNegativeMonth !== null && (
              <p role="alert" className="rounded-[10px] border border-neg/40 bg-neg/10 px-3 py-2 text-sm text-neg">
                In this scenario your cash would run out around {monthName(result.startMonth, s.firstNegativeMonth)}. Try the Stress test tab for preparation steps.
              </p>
            )}
            {s.goals.length > 0 && (
              <Card title="Goals">
                <ul className="space-y-2 text-sm">
                  {s.goals.map((g) => {
                    const d = result.comparison.goalDelays.find((x) => x.id === g.id);
                    return (
                      <li key={g.id} className="flex flex-wrap items-center gap-2">
                        <span className="flex-1">{g.name}</span>
                        <span className="text-ink2">{g.completionMonth === null ? "Not reached in this period" : `Reached ${monthName(result.startMonth, g.completionMonth)}`}</span>
                        {changes.length > 0 && d?.delayMonths ? <Badge tone={d.delayMonths > 0 ? "warn" : "pos"}>{d.delayMonths > 0 ? `${monthsText(d.delayMonths)} later` : `${monthsText(-d.delayMonths)} sooner`}</Badge> : null}
                        {changes.length > 0 && d && d.delayMonths === null && d.endSavedDeltaCents !== 0 ? <Badge tone={d.endSavedDeltaCents < 0 ? "warn" : "pos"}>{deltaText(d.endSavedDeltaCents, c)} saved by the end</Badge> : null}
                        {d?.becameOffTrack ? <Badge tone="neg">Now misses its target date</Badge> : g.onTrack === false ? <Badge tone="neutral">Behind its target date</Badge> : null}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
            {result.drivers.length > 1 && (
              <Card title="What drives the difference">
                <ul className="space-y-1.5 text-sm">
                  {result.drivers.map((d) => (
                    <li key={d.index} className="flex items-center gap-2">
                      <span className="flex-1">{d.label}</span>
                      <span className={`num ${d.endNetWorthDeltaCents < 0 ? "text-neg" : "text-pos"}`}>{deltaText(d.endNetWorthDeltaCents, c)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-ink3">Each change applied on its own, measured as net worth at the end of the period.</p>
              </Card>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Explain summary="Assumptions behind this projection">
                <ul className="list-disc space-y-1 pl-4">
                  <li>Month 1 is the next 30 days. Income and spending repeat at your recent monthly averages.</li>
                  <li>Goal contributions come from each month&apos;s surplus; months without a surplus skip them.</li>
                  <li>Investments grow {result.assumptions.annualReturnPct.expected}% a year (range {result.assumptions.annualReturnPct.adverse}% to {result.assumptions.annualReturnPct.best}%).</li>
                  <li>The shaded range moves discretionary spending ±{result.assumptions.spendingVariancePct}%.</li>
                  <li>Debt interest is included only for debts where you entered an APR.</li>
                  <li>{PROJECTION_NOTE}</li>
                </ul>
              </Explain>
              <Button variant="secondary" size="sm" onClick={save} loading={saving}>
                <Save className="size-3.5" /> Save this plan
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, sub, delta, good, warn }: { label: string; value: string; sub?: string; delta?: string | null; good?: boolean; warn?: boolean }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-ink3">{label}</p>
      <p className={`num mt-1 font-display text-xl font-semibold ${warn ? "text-neg" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-ink3">{sub}</p>}
      {delta && delta !== "No change" && <p className={`num mt-1 text-xs ${good ? "text-pos" : "text-neg"}`}>{delta} vs current path</p>}
    </div>
  );
}

function ChangeFields({ d, update, goals }: { d: Draft; update: (p: Partial<Draft>) => void; goals: { id: string; name: string }[] }) {
  const id = (s: string) => `c${d.key}-${s}`;
  const startLabel = d.kind === "one_time" ? "When (months from now)" : "Starts in (months)";
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {d.kind === "expense" && (
        <Field label="Applies to" htmlFor={id("bucket")} className="col-span-2">
          <Select id={id("bucket")} value={d.bucket} onChange={(e) => update({ bucket: e.target.value as Draft["bucket"] })}>
            <option value="essential">Essential costs (rent, bills…)</option>
            <option value="discretionary">Discretionary spending</option>
          </Select>
        </Field>
      )}
      {(d.kind === "income" || d.kind === "expense") && (
        <Field label="Change by %" htmlFor={id("pct")}>
          <Input id={id("pct")} inputMode="decimal" value={d.percent} onChange={(e) => update({ percent: e.target.value })} placeholder="-15" />
        </Field>
      )}
      <Field label={d.kind === "income" || d.kind === "expense" ? "or by $ / month" : d.kind === "one_time" ? "Amount" : d.kind === "financed_purchase" ? "Amount financed" : "Per month"} htmlFor={id("amt")}>
        <DollarInput id={id("amt")} value={d.amount} onChange={(v) => update({ amount: v })} allowNegative={d.kind !== "extra_saving" && d.kind !== "extra_debt_payment" && d.kind !== "financed_purchase"} />
      </Field>
      <Field label={startLabel} htmlFor={id("start")}>
        <Input id={id("start")} type="number" min={0} max={119} value={d.month} onChange={(e) => update({ month: e.target.value })} />
      </Field>
      {(d.kind === "income" || d.kind === "expense" || d.kind === "financed_purchase") && (
        <Field label={d.kind === "financed_purchase" ? "Months to repay" : "For how many months"} htmlFor={id("dur")} hint={d.kind === "financed_purchase" ? undefined : "Blank = permanent"}>
          <Input id={id("dur")} type="number" min={1} value={d.duration} onChange={(e) => update({ duration: e.target.value })} />
        </Field>
      )}
      {d.kind === "financed_purchase" && (
        <Field label="APR %" htmlFor={id("apr")}>
          <Input id={id("apr")} inputMode="decimal" value={d.apr} onChange={(e) => update({ apr: e.target.value })} />
        </Field>
      )}
      {d.kind === "extra_saving" && goals.length > 0 && (
        <Field label="Toward goal" htmlFor={id("goal")} className="col-span-2">
          <Select id={id("goal")} value={d.goalId} onChange={(e) => update({ goalId: e.target.value })}>
            <option value="">First unfinished goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {d.kind === "one_time" && <p className="col-span-2 text-[11px] text-ink3">Negative amount = money coming in (bonus, tax refund).</p>}
    </div>
  );
}

