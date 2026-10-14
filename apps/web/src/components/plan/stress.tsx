"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { PlanComparison, PlanSummary, PreparationStep } from "@veltrix/shared";
import { ProjectionChart } from "@/components/charts";
import { Badge, Card, EmptyState, Field, FormError, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { DollarInput, Explain, monthName, monthsText, PROJECTION_NOTE, toCents } from "./common";

interface StressResult {
  startMonth: string;
  canProject: boolean;
  runway: { noIncomeMonths: number | null; firstNegativeMonth: number | null; adverseFirstNegativeMonth: number | null };
  baseline: { summary: PlanSummary; series: { month: number; liquidCents: number }[] };
  stressed: { summary: PlanSummary; series: { month: number; liquidCents: number }[] };
  comparison: PlanComparison;
  steps: PreparationStep[];
  assumptions: { emergencyMonths: number; spendingVariancePct: number };
}

const PRESETS = [
  { label: "Lose my job for 3 months", v: { loss: 3, replace: 0, cost: "", rent: "", cut: 30 } },
  { label: "Big car repair", v: { loss: 0, replace: 0, cost: "3000", rent: "", cut: 0 } },
  { label: "Rent goes up $300", v: { loss: 0, replace: 0, cost: "", rent: "300", cut: 0 } },
  { label: "Medical bill + 2 months off work", v: { loss: 2, replace: 60, cost: "2000", rent: "", cut: 25 } },
  { label: "Everything at once", v: { loss: 3, replace: 0, cost: "3000", rent: "300", cut: 40 } },
];

export function StressTest({ currency }: { currency: string }) {
  const [v, setV] = useState({ loss: 3, replace: 0, cost: "", rent: "", cut: 30 });
  const [result, setResult] = useState<StressResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const c = currency;
  const costCents = v.cost.trim() ? toCents(v.cost) : 0;
  const rentCents = v.rent.trim() ? toCents(v.rent) : 0;
  const invalid = costCents === null || rentCents === null;

  useEffect(() => {
    if (invalid) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api<StressResult>("/api/plan/stress", { body: { incomeLossMonths: v.loss, incomeReplacementPct: v.replace, emergencyCostCents: costCents, essentialIncreaseCents: rentCents, discretionaryCutPct: v.cut, horizonMonths: 12 } });
        if (id === seq.current) setResult(r);
      } catch (e) {
        if (id === seq.current) setError(e instanceof ApiError ? e.message : "Couldn't run the stress test.");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [v.loss, v.replace, v.cut, costCents, rentCents, invalid]);

  const chart = useMemo(
    () => (result ? result.stressed.series.map((s, i) => ({ label: monthName(result.startMonth, s.month), scenario: s.liquidCents, baseline: result.baseline.series[i].liquidCents })) : []),
    [result],
  );
  const neg = result?.stressed.summary.firstNegativeMonth ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card title="Build a hard month">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setV(p.v)} className="rounded-full border border-line bg-bg2 px-3 py-1.5 text-xs text-ink2 hover:border-blue hover:text-ink">
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <Field label={`Months without income: ${v.loss}`} htmlFor="s-loss">
            <input id="s-loss" type="range" min={0} max={12} value={v.loss} onChange={(e) => setV({ ...v, loss: Number(e.target.value) })} className="w-full accent-[#3B82F6]" />
          </Field>
          {v.loss > 0 && (
            <Field label={`Income still received: ${v.replace}%`} htmlFor="s-rep" hint="e.g. unemployment benefits or partial pay">
              <input id="s-rep" type="range" min={0} max={100} step={5} value={v.replace} onChange={(e) => setV({ ...v, replace: Number(e.target.value) })} className="w-full accent-[#3B82F6]" />
            </Field>
          )}
          <Field label="Unexpected expense now" htmlFor="s-cost">
            <DollarInput id="s-cost" value={v.cost} onChange={(x) => setV({ ...v, cost: x })} />
          </Field>
          <Field label="Essential costs rise by (per month)" htmlFor="s-rent">
            <DollarInput id="s-rent" value={v.rent} onChange={(x) => setV({ ...v, rent: x })} />
          </Field>
          <Field label={`You'd cut discretionary spending by: ${v.cut}%`} htmlFor="s-cut">
            <input id="s-cut" type="range" min={0} max={100} step={5} value={v.cut} onChange={(e) => setV({ ...v, cut: Number(e.target.value) })} className="w-full accent-[#3B82F6]" />
          </Field>
          {invalid && <FormError message="Check the dollar amounts." />}
          <p className="text-[11px] text-ink3">These are hypothetical situations you set up to prepare. VELTRIX isn&apos;t predicting they&apos;ll happen.</p>
        </div>
      </Card>

      <div className="space-y-4">
        {error && <FormError message={error} />}
        {!result && loading && (
          <div className="panel grid h-[300px] place-items-center">
            <Spinner />
          </div>
        )}
        {result && !result.canProject && <EmptyState title="Add your income and spending to run a stress test" body="VELTRIX needs your monthly income and spending to model a hard month. Finish guided setup or connect a bank." />}
        {result?.canProject && (
          <>
            <div className={`rounded-[16px] border p-5 ${neg === null ? "border-pos/40 bg-pos/10" : "border-warn/40 bg-warn/10"}`}>
              <p className="flex items-center gap-2 font-display text-xl font-semibold">
                {neg === null ? <ShieldCheck className="size-5 text-pos" aria-hidden /> : <ShieldAlert className="size-5 text-warn" aria-hidden />}
                {neg === null ? "Your reserves hold through this scenario" : `Reserves would run out around ${monthName(result.startMonth, neg)}`}
              </p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-ink3">Cash covers essentials with no income for</p>
                  <p className="num text-lg font-semibold">{result.runway.noIncomeMonths === null ? "Unknown" : monthsText(result.runway.noIncomeMonths)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink3">Lowest cash point</p>
                  <p className={`num text-lg font-semibold ${result.stressed.summary.lowestLiquid.cents < 0 ? "text-neg" : ""}`}>{money(result.stressed.summary.lowestLiquid.cents, c, { noCents: true })}</p>
                  <p className="text-[11px] text-ink3">{monthName(result.startMonth, result.stressed.summary.lowestLiquid.month)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink3">Cost vs. normal path (12 months)</p>
                  <p className="num text-lg font-semibold">{money(-result.comparison.endLiquidDeltaCents, c, { noCents: true })}</p>
                </div>
              </div>
              {neg === null && result.runway.adverseFirstNegativeMonth !== null && <p className="mt-2 text-xs text-warn">If spending also runs {result.assumptions.spendingVariancePct}% higher than usual, reserves could run out around {monthName(result.startMonth, result.runway.adverseFirstNegativeMonth)}.</p>}
            </div>
            <Card title="Cash reserves: hard month vs. normal">
              <div className={loading ? "opacity-60" : ""}>
                <ProjectionChart data={chart} currency={c} scenarioLabel="Stress scenario" baselineLabel="Normal path" height={240} />
              </div>
            </Card>
            {result.comparison.goalDelays.some((g) => g.delayMonths || g.becameOffTrack) && (
              <Card title="Goals affected">
                <ul className="space-y-1.5 text-sm">
                  {result.comparison.goalDelays
                    .filter((g) => g.delayMonths || g.becameOffTrack)
                    .map((g) => (
                      <li key={g.id} className="flex items-center gap-2">
                        <span className="flex-1">{g.name}</span>
                        {g.delayMonths ? <Badge tone="warn">{monthsText(g.delayMonths)} later</Badge> : null}
                        {g.becameOffTrack && <Badge tone="neg">Misses target date</Badge>}
                      </li>
                    ))}
                </ul>
              </Card>
            )}
            <Card title="How to prepare">
              <ol className="space-y-3">
                {result.steps.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue/15 text-xs text-cyan">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">
                        {s.title}
                        {s.impactCents ? <span className="num ml-2 text-xs font-normal text-ink2">{money(s.impactCents, c, { noCents: true })}{/pause|Review/.test(s.title) ? "/mo" : ""}</span> : null}
                      </p>
                      <p className="text-xs text-ink2">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
            <Explain summary="How this is calculated">
              <ul className="list-disc space-y-1 pl-4">
                <li>&quot;Covers essentials&quot; = cash after the unexpected expense ÷ monthly essential spending (plus any increase), assuming no income at all.</li>
                <li>The chart applies your settings month by month: lost income, the one-time cost, higher essentials, and the discretionary cut during the income loss.</li>
                <li>{PROJECTION_NOTE}</li>
              </ul>
            </Explain>
          </>
        )}
      </div>
    </div>
  );
}
