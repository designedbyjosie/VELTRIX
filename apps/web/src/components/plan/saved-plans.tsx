"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Clock, History, Info } from "lucide-react";
import { Badge, Button, Card, ConfirmButton, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import { monthName } from "./common";

interface PlanRow {
  id: string;
  name: string;
  kind: string;
  startMonth: string;
  createdAt: string;
  decision: { verdict: string; choice: string } | null;
}
interface Detail {
  id: string;
  name: string;
  kind: string;
  createdAt: string;
  startMonth: string;
  elapsedMonths: number;
  baseline: { monthlyIncomeCents: number; essentialCents: number; discretionaryCents: number; liquidCents: number; currency: string };
  assumptions: { emergencyMonths: number; annualReturnPct: { expected: number }; spendingVariancePct: number };
  changes: { label: string }[];
  decision: { label: string; verdict: string; choice: string } | null;
  rows: { month: number; ym: string; complete: boolean; projected: { liquidCents: number; incomeCents: number; spendingCents: number }; actual: { liquidCents: number | null; incomeCents: number | null; spendingCents: number | null } }[];
  findings: { kind: "accurate" | "differs" | "info"; text: string }[];
  goals: { id: string; name: string; plannedMonth: string | null; nowMonth: string | null; stillExists: boolean }[];
}

const KIND = { scenario: "What-if", purchase: "Purchase decision", stress: "Stress test" } as Record<string, string>;
const CHOICE = { buy_now: "Buy now", buy_later: "Buy later", alternative: "Cheaper option", financed: "Finance", skip: "Skip", undecided: "Undecided" } as Record<string, string>;
const ym = (s: string) => monthName(s, 0);

export function SavedPlans({ currency }: { currency: string }) {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ plans: PlanRow[] }>("/api/plan/snapshots")
      .then((r) => setPlans(r.plans))
      .catch(() => setPlans([]));
  }, []);

  async function show(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      setOpen((await api<{ plan: Detail }>(`/api/plan/snapshots/${id}`)).plan);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this plan.");
    } finally {
      setLoadingId(null);
    }
  }

  if (plans === null)
    return (
      <div className="panel grid h-40 place-items-center">
        <Spinner />
      </div>
    );
  if (!plans.length)
    return <EmptyState icon={<History className="size-5" />} title="No saved plans yet" body="Save a what-if, a purchase decision or a stress test. Later, VELTRIX compares it with what actually happened: which assumptions held, what changed, and whether your goals are still on track." />;

  const c = currency;
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <Card title="Saved plans">
        <ul className="space-y-1.5">
          {plans.map((p) => (
            <li key={p.id}>
              <button onClick={() => show(p.id)} className={`w-full rounded-[10px] border px-3 py-2.5 text-left transition ${open?.id === p.id ? "border-blue bg-blue/10" : "border-line-soft hover:border-blue/50"}`}>
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink3">
                  <Badge tone="neutral">{KIND[p.kind] ?? p.kind}</Badge>
                  Saved {shortDate(p.createdAt, { month: "short", day: "numeric", year: "numeric" })}
                  {loadingId === p.id && <Spinner className="size-3" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        {error && <p className="text-sm text-neg">{error}</p>}
        {!open ? (
          <div className="panel grid min-h-[200px] place-items-center p-6 text-center text-sm text-ink2">Choose a plan to compare what you expected with what happened.</div>
        ) : (
          <>
            <Card
              title={open.name}
              action={
                <ConfirmButton
                  title="Delete this saved plan?"
                  body="The snapshot and its comparison will be removed. Your accounts and transactions aren't affected."
                  onConfirm={async () => {
                    await api(`/api/plan/snapshots/${open.id}`, { method: "DELETE" });
                    setPlans((xs) => xs!.filter((x) => x.id !== open.id));
                    setOpen(null);
                  }}
                >
                  Delete
                </ConfirmButton>
              }
            >
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink2">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden /> Saved {new Date(open.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span>Plan starts {ym(open.startMonth)} · {open.elapsedMonths} month{open.elapsedMonths === 1 ? "" : "s"} elapsed</span>
                {open.decision && (
                  <span>
                    Decision: {CHOICE[open.decision.choice] ?? open.decision.choice} (review said &quot;{open.decision.verdict === "fits" ? "Fits your plan" : open.decision.verdict === "consider" ? "Consider alternatives" : open.decision.verdict === "risk" ? "Could put a goal at risk" : "Not enough data"}&quot;)
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-ink3">
                Changes: {open.changes.length ? open.changes.map((x) => x.label).join(", ") : "none (your path as it was)"}. Assumed income {money(open.baseline.monthlyIncomeCents, c, { noCents: true })}/mo, spending {money(open.baseline.essentialCents + open.baseline.discretionaryCents, c, { noCents: true })}/mo, cash {money(open.baseline.liquidCents, c, { noCents: true })}.
              </p>
            </Card>

            <Card title="What happened">
              <ul className="space-y-2">
                {open.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {f.kind === "accurate" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pos" aria-hidden /> : f.kind === "differs" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0 text-ink3" aria-hidden />}
                    {f.text}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Projected vs. actual">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-xs text-ink3">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Month</th>
                      <th className="py-2 pr-3 font-medium">Cash at month end (plan → actual)</th>
                      <th className="py-2 pr-3 font-medium">Income</th>
                      <th className="py-2 font-medium">Spending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {open.rows.map((r) => (
                      <tr key={r.month}>
                        <td className="py-2 pr-3">
                          {monthName(open.startMonth, r.month)}
                          {!r.complete && <span className="ml-1 text-[11px] text-ink3">(so far)</span>}
                        </td>
                        <Pair plan={r.projected.liquidCents} actual={r.actual.liquidCents} c={c} inProgress={!r.complete} />
                        <Pair plan={r.projected.incomeCents} actual={r.complete ? r.actual.incomeCents : null} c={c} />
                        <Pair plan={r.projected.spendingCents} actual={r.complete ? r.actual.spendingCents : null} c={c} lowerIsBetter />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-ink3">The saved projection never changes. Actual cash uses the balance history of the accounts the plan was built on; income and spending appear once a month is complete.</p>
            </Card>

            {open.goals.length > 0 && (
              <Card title="Goals: then vs. now">
                <ul className="space-y-1.5 text-sm">
                  {open.goals.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-center gap-2">
                      <span className="flex-1">{g.name}</span>
                      {!g.stillExists ? (
                        <Badge tone="neutral">Goal removed</Badge>
                      ) : (
                        <span className="text-xs text-ink2">
                          Planned: {g.plannedMonth ? ym(g.plannedMonth) : "not in period"} → Now projected: {g.nowMonth ? ym(g.nowMonth) : "not in period"}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
              Close
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Pair({ plan, actual, c, lowerIsBetter, inProgress }: { plan: number; actual: number | null; c: string; lowerIsBetter?: boolean; inProgress?: boolean }) {
  const diff = actual === null ? 0 : actual - plan;
  const good = lowerIsBetter ? diff <= 0 : diff >= 0;
  return (
    <td className="num py-2 pr-3">
      <span className="text-ink2">{money(plan, c, { noCents: true })}</span>
      <span className="mx-1 text-ink3">→</span>
      {actual === null ? <span className="text-ink3">—</span> : inProgress ? <span className="text-ink" title="Today's balance; the month isn't over">{money(actual, c, { noCents: true })} <span className="text-[10px] text-ink3">today</span></span> : <span className={Math.abs(diff) < Math.max(1000, Math.abs(plan) * 0.05) ? "text-ink" : good ? "text-pos" : "text-warn"}>{money(actual, c, { noCents: true })}</span>}
    </td>
  );
}
