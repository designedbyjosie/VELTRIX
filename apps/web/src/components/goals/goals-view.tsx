"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Car, GraduationCap, Home, Palmtree, Plus, ShieldCheck, Target, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { goalKinds } from "@veltrix/shared";
import { Badge, Button, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Modal, Progress, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, monthLabel, shortDate, titleCase } from "@/lib/format";

export interface GoalView {
  id: string;
  name: string;
  kind: string;
  currency: string;
  targetCents: number;
  startingCents: number;
  savedCents: number;
  targetDate: string | null;
  plannedMonthlyCents: number | null;
  source: string;
  projection: { percent: number; remainingCents: number; monthsLeft: number | null; requiredMonthlyCents: number | null; projectedCompletion: string | null; onTrack: boolean | null; assumptions: string[] };
  contributions: { id: string; amountCents: number; date: string; note: string }[];
}

const ICON: Record<string, LucideIcon> = { EMERGENCY_FUND: ShieldCheck, VACATION: Palmtree, CAR: Car, HOME: Home, DEBT: Wallet, RETIREMENT: TrendingUp, EDUCATION: GraduationCap, OTHER: Target };
const PRESET_NAMES: Record<string, string> = { EMERGENCY_FUND: "Emergency fund", VACATION: "Vacation", CAR: "New car", HOME: "Home deposit", DEBT: "Pay off debt", RETIREMENT: "Retirement", EDUCATION: "Education", OTHER: "" };

function GoalForm({ goal, presetKind, onDone }: { goal?: GoalView; presetKind?: string; onDone: () => void }) {
  const [kind, setKind] = useState(goal?.kind ?? presetKind ?? "OTHER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const clean = (k: string) => String(f.get(k) ?? "").replace(/[$,\s]/g, "");
        const body = {
          name: String(f.get("name")),
          kind,
          target: clean("target"),
          startingAmount: clean("startingAmount") || "0",
          targetDate: String(f.get("targetDate")) || null,
          plannedMonthly: clean("plannedMonthly") || null,
        };
        setBusy(true);
        setError(null);
        try {
          if (goal) await api(`/api/goals/${goal.id}`, { method: "PATCH", body });
          else await api("/api/goals", { body });
          toast(goal ? "Goal updated" : "Goal created");
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && !error.fields.length && <FormError message={error.message} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="g-kind">
          <Select id="g-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {goalKinds.map((k) => (
              <option key={k} value={k}>
                {titleCase(k)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name" htmlFor="g-name" error={error?.fieldError("name")}>
          <Input id="g-name" name="name" required defaultValue={goal?.name ?? PRESET_NAMES[presetKind ?? ""] ?? ""} key={kind} placeholder="Dream vacation" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target amount" htmlFor="g-target" error={error?.fieldError("target")}>
          <Input id="g-target" name="target" inputMode="decimal" required defaultValue={goal ? (goal.targetCents / 100).toFixed(2) : ""} placeholder="10000.00" />
        </Field>
        <Field label="Already saved" htmlFor="g-start" error={error?.fieldError("startingAmount")}>
          <Input id="g-start" name="startingAmount" inputMode="decimal" defaultValue={goal ? (goal.startingCents / 100).toFixed(2) : ""} placeholder="0.00" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target date" htmlFor="g-date" hint="Optional">
          <Input id="g-date" name="targetDate" type="date" defaultValue={goal?.targetDate ?? ""} />
        </Field>
        <Field label="Planned monthly saving" htmlFor="g-monthly" hint="Optional" error={error?.fieldError("plannedMonthly")}>
          <Input id="g-monthly" name="plannedMonthly" inputMode="decimal" defaultValue={goal?.plannedMonthlyCents ? (goal.plannedMonthlyCents / 100).toFixed(2) : ""} placeholder="500.00" />
        </Field>
      </div>
      {kind === "EMERGENCY_FUND" && <p className="text-xs text-ink3">A common guideline is 3–6 months of essential expenses. The Savings page estimates yours from your transactions.</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {goal ? "Save goal" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}

function ContributionForm({ goal, onDone }: { goal: GoalView; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const sign = f.get("direction") === "withdraw" ? "-" : "";
        setBusy(true);
        setError(null);
        try {
          await api(`/api/goals/${goal.id}/contributions`, { body: { amount: sign + String(f.get("amount")).replace(/[$,\s-]/g, ""), date: String(f.get("date")), note: String(f.get("note") ?? "") } });
          toast("Contribution recorded");
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && !error.fields.length && <FormError message={error.message} />}
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="direction" value="add" defaultChecked className="accent-[#2878FF]" /> Add money
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="direction" value="withdraw" className="accent-[#2878FF]" /> Withdraw
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" htmlFor="c-amount" error={error?.fieldError("amount")}>
          <Input id="c-amount" name="amount" inputMode="decimal" required placeholder="0.00" />
        </Field>
        <Field label="Date" htmlFor="c-date">
          <Input id="c-date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
      </div>
      <Field label="Note" htmlFor="c-note">
        <Input id="c-note" name="note" placeholder="Optional" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Record
        </Button>
      </div>
    </form>
  );
}

export function GoalsView({ goals }: { goals: GoalView[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [creating, setCreating] = useState<string | null>(null);
  const [editing, setEditing] = useState<GoalView | null>(null);
  const [contributing, setContributing] = useState<GoalView | null>(null);
  const toast = useToast();
  useEffect(() => {
    const n = params.get("new");
    if (n) setCreating(goalKinds.includes(n as (typeof goalKinds)[number]) ? n : "OTHER");
  }, [params]);
  const done = () => {
    setCreating(null);
    setEditing(null);
    setContributing(null);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setCreating("OTHER")}>
          <Plus className="size-4" /> New goal
        </Button>
      </div>
      {goals.length === 0 ? (
        <div className="panel p-6">
          <EmptyState icon={<Target className="size-5" />} title="Set your first goal" body="Pick a target and date. VELTRIX shows the monthly amount needed and whether you're on track." />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["EMERGENCY_FUND", "VACATION", "CAR", "HOME", "DEBT", "RETIREMENT"].map((k) => {
              const Icon = ICON[k];
              return (
                <Button key={k} size="sm" onClick={() => setCreating(k)}>
                  <Icon className="size-4" /> {PRESET_NAMES[k]}
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((g) => {
            const Icon = ICON[g.kind] ?? Target;
            const p = g.projection;
            return (
              <article key={g.id} className="panel flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-blue/25 to-violet/25 text-cyan">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                      {g.name} {g.source === "DEMO" && <DemoBadge />}
                    </h2>
                    <p className="text-xs text-ink3">
                      {titleCase(g.kind)}
                      {g.targetDate ? ` · target ${shortDate(g.targetDate, { month: "long", year: "numeric" })}` : ""}
                    </p>
                  </div>
                  {p.onTrack === true && <Badge tone="pos">On track</Badge>}
                  {p.onTrack === false && <Badge tone="warn">Behind</Badge>}
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <p className="num font-display text-2xl font-semibold">{money(g.savedCents, g.currency, { noCents: true })}</p>
                  <p className="num text-sm text-ink2">of {money(g.targetCents, g.currency, { noCents: true })} · {p.percent.toFixed(0)}%</p>
                </div>
                <Progress className="mt-2 h-2" value={p.percent} tone={p.onTrack === false ? "warn" : "pos"} label={`${g.name} progress`} />
                <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="text-ink3">Needed / month</dt>
                    <dd className="num mt-0.5 text-sm text-ink">{p.requiredMonthlyCents !== null ? money(p.requiredMonthlyCents, g.currency, { noCents: true }) : "Set a date"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink3">Your plan / month</dt>
                    <dd className="num mt-0.5 text-sm text-ink">{g.plannedMonthlyCents !== null ? money(g.plannedMonthlyCents, g.currency, { noCents: true }) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink3">Projected finish</dt>
                    <dd className="mt-0.5 text-sm text-ink">{p.projectedCompletion ? monthLabel(p.projectedCompletion, "long") : "Add a monthly plan"}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-ink3">{p.assumptions.join(" ")}</p>
                {g.contributions.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-xs text-cyan">Recent contributions ({g.contributions.length})</summary>
                    <ul className="mt-2 space-y-1">
                      {g.contributions.slice(0, 8).map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 text-xs text-ink2">
                          <span>
                            {shortDate(c.date, { month: "short", day: "numeric", year: "numeric" })} {c.note && `· ${c.note}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className={`num ${c.amountCents < 0 ? "text-neg" : "text-ink"}`}>{money(c.amountCents, g.currency, { showSign: true })}</span>
                            <button
                              className="rounded px-1 text-ink3 hover:text-neg"
                              aria-label="Remove contribution"
                              onClick={async () => {
                                await api(`/api/goals/${g.id}/contributions/${c.id}`, { method: "DELETE" });
                                router.refresh();
                              }}
                            >
                              ×
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button size="sm" variant="primary" onClick={() => setContributing(g)}>
                    Record contribution
                  </Button>
                  <Button size="sm" onClick={() => setEditing(g)}>
                    Edit
                  </Button>
                  <ConfirmButton
                    title={`Delete "${g.name}"?`}
                    body="The goal and its contribution history are removed."
                    onConfirm={async () => {
                      await api(`/api/goals/${g.id}`, { method: "DELETE" });
                      toast("Goal deleted");
                      router.refresh();
                    }}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Modal open={!!creating} onClose={() => setCreating(null)} title="New goal">
        {creating && <GoalForm presetKind={creating} onDone={done} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit goal">
        {editing && <GoalForm goal={editing} onDone={done} />}
      </Modal>
      <Modal open={!!contributing} onClose={() => setContributing(null)} title={`Contribution to ${contributing?.name ?? ""}`}>
        {contributing && <ContributionForm goal={contributing} onDone={done} />}
      </Modal>
    </div>
  );
}
