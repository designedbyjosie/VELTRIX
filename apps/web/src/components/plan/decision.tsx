"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Lightbulb, Save } from "lucide-react";
import type { DecisionReason, PlanComparison, PlanSummary, ScenarioChange } from "@veltrix/shared";
import { Badge, Button, Card, Field, FormError, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { useToast } from "@/components/ui";
import { DollarInput, Explain, FigureTile, monthName, monthsText, PROJECTION_NOTE, toCents, type Figure } from "./common";

interface Option {
  key: "buy_now" | "buy_later" | "alternative" | "financed" | "skip";
  label: string;
  summary: PlanSummary;
  adverse: PlanSummary;
  vsSkip: PlanComparison;
  changes: ScenarioChange[];
}
interface Decision {
  verdict: "fits" | "consider" | "risk";
  confidence: "normal" | "limited";
  reasons: DecisionReason[];
  options: Option[];
  missing: string[];
  costPerUseCents: number | null;
  monthsToSaveFor: number | null;
  startMonth: string;
  category: { name: string; remainingCents: number | null } | null;
  figures: { liquid: Figure; income: Figure; essential: Figure; surplus: Figure };
  assumptions: { emergencyMonths: number };
}

const VERDICT = {
  fits: { title: "Fits your plan", icon: CheckCircle2, tone: "border-pos/40 bg-pos/10 text-pos", body: "Based on the information available, this purchase is consistent with your goals and cash needs." },
  consider: { title: "Consider alternatives", icon: Lightbulb, tone: "border-warn/40 bg-warn/10 text-warn", body: "A different timing, price or payment option may fit your goals better. Here's why." },
  risk: { title: "Could put a goal at risk", icon: AlertTriangle, tone: "border-neg/40 bg-neg/10 text-neg", body: "This may conflict with money you've committed or a goal you've set. Here's what we found." },
} as const;

const CATEGORIES = [
  ["", "No specific budget"],
  ["shopping", "Shopping"],
  ["entertainment", "Entertainment"],
  ["travel", "Travel"],
  ["food", "Food & dining"],
  ["transport", "Transportation"],
  ["health", "Health"],
  ["housing", "Housing"],
  ["utilities", "Utilities"],
  ["subscriptions", "Subscriptions"],
  ["other", "Other"],
] as const;

export function PurchaseDecision({ currency, initial }: { currency: string; initial?: { label?: string; price?: string } }) {
  const toast = useToast();
  const [form, setForm] = useState({ label: initial?.label ?? "", price: initial?.price ?? "", category: "", altLabel: "", altPrice: "", finance: false, months: "12", apr: "0", wait: "", uses: "" });
  const [result, setResult] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const c = currency;

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    const price = toCents(form.price);
    if (!form.label.trim()) return setError("What are you thinking of buying?");
    if (!price) return setError("Enter the price.");
    const altPrice = form.altPrice.trim() ? toCents(form.altPrice) : null;
    if (form.altPrice.trim() && !altPrice) return setError("Check the alternative's price.");
    setLoading(true);
    setError(null);
    setSaved(null);
    try {
      const r = await api<{ decision: Decision }>("/api/plan/decision", {
        body: {
          label: form.label.trim(),
          priceCents: price,
          categorySlug: form.category || null,
          alternative: altPrice ? { label: form.altLabel.trim() || "Cheaper option", priceCents: altPrice } : null,
          financing: form.finance ? { months: Number(form.months), aprPercent: Number(form.apr) } : null,
          waitMonths: form.wait ? Number(form.wait) : undefined,
          usesPerMonth: form.uses ? Number(form.uses) : null,
        },
      });
      setResult(r.decision);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't review this purchase.");
    } finally {
      setLoading(false);
    }
  }

  async function record(option: Option | null) {
    if (!result) return;
    try {
      await api("/api/plan/snapshots", {
        body: {
          name: `${form.label.trim()}: ${option ? option.label : "undecided"}`.slice(0, 80),
          kind: "purchase",
          changes: option?.changes ?? [],
          horizonMonths: 24,
          decision: { label: form.label.trim(), priceCents: toCents(form.price)!, verdict: result.verdict, choice: option?.key ?? "undecided" },
        },
      });
      setSaved(option?.key ?? "undecided");
      toast("Decision saved. Check back under Saved plans to see how it played out.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save the decision", "neg");
    }
  }

  const v = result ? VERDICT[result.verdict] : null;
  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card title="Think before you spend">
        <form className="space-y-3" onSubmit={run}>
          <Field label="What is it?" htmlFor="d-label">
            <Input id="d-label" value={form.label} maxLength={80} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. New laptop" />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Price" htmlFor="d-price">
              <DollarInput id="d-price" value={form.price} onChange={(v) => set({ price: v })} placeholder="1500" />
            </Field>
            <Field label="Budget category" htmlFor="d-cat">
              <Select id="d-cat" value={form.category} onChange={(e) => set({ category: e.target.value })}>
                {CATEGORIES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Explain summary="Compare with a cheaper option, financing or waiting">
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Cheaper option" htmlFor="d-alt">
                  <Input id="d-alt" value={form.altLabel} maxLength={80} onChange={(e) => set({ altLabel: e.target.value })} placeholder="Refurbished model" />
                </Field>
                <Field label="Its price" htmlFor="d-altp">
                  <DollarInput id="d-altp" value={form.altPrice} onChange={(v) => set({ altPrice: v })} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="size-4 accent-[#3B82F6]" checked={form.finance} onChange={(e) => set({ finance: e.target.checked })} /> I&apos;m considering financing
              </label>
              {form.finance && (
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Months" htmlFor="d-m">
                    <Input id="d-m" type="number" min={1} max={120} value={form.months} onChange={(e) => set({ months: e.target.value })} />
                  </Field>
                  <Field label="APR %" htmlFor="d-apr">
                    <Input id="d-apr" inputMode="decimal" value={form.apr} onChange={(e) => set({ apr: e.target.value })} />
                  </Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Or wait (months)" htmlFor="d-wait" hint="Default: time to save it">
                  <Input id="d-wait" type="number" min={1} max={24} value={form.wait} onChange={(e) => set({ wait: e.target.value })} />
                </Field>
                <Field label="Uses per month" htmlFor="d-uses" hint="Optional">
                  <Input id="d-uses" type="number" min={0} value={form.uses} onChange={(e) => set({ uses: e.target.value })} />
                </Field>
              </div>
            </div>
          </Explain>
          <FormError message={error} />
          <Button type="submit" variant="primary" className="w-full" loading={loading}>
            Review this purchase
          </Button>
          <p className="text-[11px] text-ink3">It&apos;s your money and your call. This shows trade-offs against the goals you set; it isn&apos;t a judgment about what you should want.</p>
        </form>
      </Card>

      <div className="space-y-4">
        {!result ? (
          <div className="panel grid min-h-[280px] place-items-center p-8 text-center">
            <div className="max-w-md">
              <p className="font-display text-lg font-semibold">See the trade-offs before you buy</p>
              <p className="mt-1 text-sm text-ink2">VELTRIX compares buying now, later, a cheaper option, financing and skipping, using your cash, upcoming bills, budget and goals with the same assumptions for each.</p>
            </div>
          </div>
        ) : (
          <>
            <div className={`rounded-[16px] border p-5 ${v!.tone}`}>
              <p className="flex items-center gap-2 font-display text-xl font-semibold">
                {v && <v.icon className="size-5" aria-hidden />} {v!.title}
              </p>
              <p className="mt-1 text-sm text-ink2">{v!.body}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-ink">
                {result.reasons.map((r) => (
                  <li key={r.code} className="flex gap-2">
                    <span aria-hidden className={r.severity === "risk" ? "text-neg" : r.severity === "consider" ? "text-warn" : "text-pos"}>
                      •
                    </span>
                    {r.text}
                  </li>
                ))}
              </ul>
              {result.confidence === "limited" && <p className="mt-3 text-xs text-warn">Limited review: VELTRIX doesn&apos;t know your {result.missing.join(" or ")}, so future cash flow wasn&apos;t projected.</p>}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink2">
                {result.monthsToSaveFor !== null && <span>Saving your monthly surplus, you could pay cash in about {monthsText(result.monthsToSaveFor)}.</span>}
                {result.costPerUseCents !== null && <span>About {money(result.costPerUseCents, c)} per use over the first year.</span>}
                {result.category && <span>{result.category.name} budget left this month: {money(Math.max(0, result.category.remainingCents ?? 0), c)}</span>}
              </div>
            </div>

            <Card title="Compare your options">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="text-left text-xs text-ink3">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Option</th>
                      <th className="py-2 pr-3 font-medium">Lowest cash</th>
                      <th className="py-2 pr-3 font-medium">Goals</th>
                      <th className="py-2 pr-3 font-medium">Interest</th>
                      <th className="py-2 pr-3 font-medium">Net worth in 2 yrs</th>
                      <th className="py-2 font-medium">
                        <span className="sr-only">Record</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {result.options.map((o) => {
                      const delays = o.vsSkip.goalDelays.filter((g) => g.delayMonths || (g.delayMonths === null && g.endSavedDeltaCents < 0));
                      return (
                        <tr key={o.key} className="align-top">
                          <td className="py-2.5 pr-3 font-medium">{o.label}</td>
                          <td className={`num py-2.5 pr-3 ${o.summary.lowestLiquid.cents < 0 ? "text-neg" : ""}`}>
                            {money(o.summary.lowestLiquid.cents, c, { noCents: true })}
                            <span className="block text-[11px] text-ink3">{monthName(result.startMonth, o.summary.lowestLiquid.month)}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-xs">
                            {o.key === "skip" ? <span className="text-ink3">As planned</span> : delays.length ? delays.map((g) => <span key={g.id} className="block text-warn">{g.name}: {g.delayMonths ? `${monthsText(g.delayMonths)} later` : `${money(-g.endSavedDeltaCents, c, { noCents: true })} less saved`}</span>) : o.vsSkip.goalDelays.some((g) => g.becameOffTrack) ? <span className="text-neg">Misses a target date</span> : <span className="text-pos">No delay</span>}
                          </td>
                          <td className="num py-2.5 pr-3">{o.vsSkip.interestDeltaCents > 0 ? money(o.vsSkip.interestDeltaCents, c, { noCents: true }) : "—"}</td>
                          <td className="num py-2.5 pr-3">{money(o.summary.endNetWorthCents, c, { noCents: true })}</td>
                          <td className="py-2.5 text-right">
                            {saved === o.key ? (
                              <Badge tone="pos">Saved</Badge>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => record(o)} aria-label={`I'll ${o.label.toLowerCase()}`}>
                                <Save className="size-3.5" /> Choose
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-ink3">Choosing an option saves it as a plan so you can compare it with what actually happens. It doesn&apos;t buy anything.</p>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FigureTile label="Available cash" figure={result.figures.liquid} currency={c} />
              <FigureTile label="Monthly income" figure={result.figures.income} currency={c} suffix="/mo" />
              <FigureTile label="Essential spending" figure={result.figures.essential} currency={c} suffix="/mo" />
              <FigureTile label="Left after spending" figure={result.figures.surplus} currency={c} suffix="/mo" />
            </div>
            <Explain summary="How the verdict is decided">
              <ul className="list-disc space-y-1 pl-4">
                <li><strong>Could put a goal at risk</strong>: cash would go below zero, fall under one month of essential spending ({money(result.figures.essential.cents ?? 0, c, { noCents: true })}), or a goal would miss its target date.</li>
                <li><strong>Consider alternatives</strong>: a goal would be reached later, it&apos;s more than the category&apos;s remaining budget, cash would fall below your {result.assumptions.emergencyMonths}-month reserve target, financing adds interest, a cheaper option is at least 10% less, or higher-than-usual spending could push cash below zero.</li>
                <li><strong>Fits your plan</strong>: none of the above.</li>
                <li>{PROJECTION_NOTE}</li>
              </ul>
            </Explain>
          </>
        )}
      </div>
    </div>
  );
}
