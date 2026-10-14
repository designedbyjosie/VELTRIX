"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChartPie, ChevronLeft, ChevronRight, Plus, TriangleAlert, X } from "lucide-react";
import { Badge, Button, Card, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Modal, Progress, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, monthLabel } from "@/lib/format";

interface Line {
  lineId: string;
  categoryId: string;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
  alertThreshold: number;
  health: "ok" | "warning" | "over";
  category: { id: string; name: string; slug: string; color: string };
}
export interface BudgetView {
  id: string;
  name: string;
  recurring: boolean;
  startMonth: string;
  currency: string;
  source: string;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
  overCount: number;
  warningCount: number;
  projectedCents: number;
  lines: Line[];
}
interface Category {
  id: string;
  name: string;
  kind: string;
}

function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function BudgetForm({ budget, month, categories, onDone }: { budget?: BudgetView; month: string; categories: Category[]; onDone: () => void }) {
  const expense = categories.filter((c) => c.kind === "EXPENSE");
  const [lines, setLines] = useState(budget ? budget.lines.map((l) => ({ categoryId: l.categoryId, limit: (l.limitCents / 100).toFixed(2), alertThreshold: l.alertThreshold })) : [{ categoryId: expense[0]?.id ?? "", limit: "", alertThreshold: 80 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();
  const total = lines.reduce((s, l) => s + (Number(l.limit) || 0), 0);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = {
          name: String(f.get("name")),
          month: String(f.get("month")),
          recurring: f.get("recurring") === "on",
          lines: lines.map((l) => ({ ...l, limit: l.limit.replace(/[$,]/g, "") })),
        };
        setBusy(true);
        setError(null);
        try {
          if (budget) await api(`/api/budgets/${budget.id}`, { method: "PATCH", body });
          else await api("/api/budgets", { body });
          toast(budget ? "Budget updated" : "Budget created");
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <FormError message={error.fields.length ? error.fields.map((f) => f.message).join(" ") : error.message} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <Field label="Budget name" htmlFor="b-name">
          <Input id="b-name" name="name" required defaultValue={budget?.name ?? "Monthly plan"} />
        </Field>
        <Field label="Starting month" htmlFor="b-month">
          <Input id="b-month" name="month" type="month" required defaultValue={budget?.startMonth ?? month} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink2">
        <input type="checkbox" name="recurring" defaultChecked={budget?.recurring ?? true} className="accent-[#2878FF]" />
        Repeat every month until archived
      </label>
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink2">Category limits</p>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_80px_32px] items-center gap-2">
              <Select aria-label="Category" value={l.categoryId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, categoryId: e.target.value } : x)))}>
                {expense.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Input aria-label="Monthly limit" inputMode="decimal" placeholder="Limit" value={l.limit} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, limit: e.target.value } : x)))} required />
              <Select aria-label="Warn at" value={String(l.alertThreshold)} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, alertThreshold: Number(e.target.value) } : x)))}>
                {[50, 70, 80, 90, 100].map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </Select>
              <button type="button" aria-label="Remove category" className="rounded-md p-1.5 text-ink3 hover:bg-white/5 hover:text-ink disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Button type="button" size="sm" variant="ghost" onClick={() => setLines([...lines, { categoryId: expense.find((c) => !lines.some((l) => l.categoryId === c.id))?.id ?? expense[0].id, limit: "", alertThreshold: 80 }])}>
            <Plus className="size-4" /> Add category
          </Button>
          <p className="num text-xs text-ink2">Total {money(Math.round(total * 100))}/month</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {budget ? "Save budget" : "Create budget"}
        </Button>
      </div>
    </form>
  );
}

export function BudgetsView({ month, budgets, categories, isCurrentMonth }: { month: string; budgets: BudgetView[]; categories: Category[]; isCurrentMonth: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BudgetView | null>(null);
  const toast = useToast();
  const go = (ym: string) => router.push(`/app/budgets?month=${ym}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => go(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <p className="min-w-36 text-center font-display text-lg font-semibold">{monthLabel(month, "long")}</p>
          <Button size="sm" onClick={() => go(shiftMonth(month, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New budget
        </Button>
      </div>
      {budgets.length === 0 ? (
        <Card>
          <EmptyState icon={<ChartPie className="size-5" />} title={`No budget for ${monthLabel(month, "long")}`} body="Set monthly limits per category. VELTRIX tracks actual spending against them and warns you before you go over." action={<Button variant="primary" size="sm" onClick={() => setCreating(true)}>Create a budget</Button>} />
        </Card>
      ) : (
        budgets.map((b) => (
          <Card
            key={b.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {b.name}
                {b.recurring && <Badge tone="info">Monthly</Badge>}
                {b.source === "DEMO" && <DemoBadge />}
              </span>
            }
            action={
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                  Edit
                </Button>
                <ConfirmButton
                  title={`Archive "${b.name}"?`}
                  body="It stops applying from now on. Past months keep their history."
                  confirmLabel="Archive"
                  onConfirm={async () => {
                    await api(`/api/budgets/${b.id}`, { method: "PATCH", body: { archived: true } });
                    toast("Budget archived");
                    router.refresh();
                  }}
                >
                  Archive
                </ConfirmButton>
              </div>
            }
          >
            <div className="mb-5 grid gap-4 sm:grid-cols-4">
              {[
                { label: "Budgeted", value: money(b.limitCents, b.currency) },
                { label: "Spent", value: money(b.spentCents, b.currency) },
                { label: b.remainingCents >= 0 ? "Remaining" : "Over by", value: money(Math.abs(b.remainingCents), b.currency), tone: b.remainingCents < 0 ? "text-neg" : "text-pos" },
                { label: isCurrentMonth ? "Projected by month end" : "Final", value: money(b.projectedCents, b.currency), tone: b.projectedCents > b.limitCents ? "text-warn" : "" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xs text-ink3">{s.label}</p>
                  <p className={`num font-display text-xl font-semibold ${s.tone ?? ""}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {b.lines.map((l) => (
                <li key={l.lineId}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-[3px]" style={{ background: l.category.color }} />
                      {l.category.name}
                      {l.health === "over" && <Badge tone="neg"><TriangleAlert className="size-3" /> Over</Badge>}
                      {l.health === "warning" && <Badge tone="warn">{Math.round(l.percentUsed)}%</Badge>}
                    </span>
                    <span className="num text-ink2">
                      <span className="text-ink">{money(l.spentCents, b.currency, { noCents: true })}</span> / {money(l.limitCents, b.currency, { noCents: true })}
                    </span>
                  </div>
                  <Progress value={l.percentUsed} tone={l.health === "over" ? "neg" : l.health === "warning" ? "warn" : "brand"} label={`${l.category.name} budget used`} />
                  <p className="mt-1 text-xs text-ink3">{l.remainingCents >= 0 ? `${money(l.remainingCents, b.currency)} left` : `${money(-l.remainingCents, b.currency)} over`} · warns at {l.alertThreshold}%</p>
                </li>
              ))}
            </ul>
            {isCurrentMonth && <p className="mt-4 text-[11px] text-ink3">Projection assumes spending continues at this month&apos;s daily pace. Transfers between your accounts aren&apos;t counted.</p>}
          </Card>
        ))
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="New budget" wide>
        <BudgetForm month={month} categories={categories} onDone={() => { setCreating(false); router.refresh(); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit budget" wide>
        {editing && <BudgetForm budget={editing} month={month} categories={categories} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
    </div>
  );
}
