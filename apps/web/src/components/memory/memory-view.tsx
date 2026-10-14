"use client";

import Link from "next/link";
import { useState } from "react";
import { Brain, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { MemoryValue } from "@veltrix/shared";
import type { SerializedMemory } from "@/server/services/memory";
import { Badge, Button, Card, ConfirmButton, EmptyState, Field, FormError, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { DollarInput, toCents } from "@/components/plan/common";

type Kind = MemoryValue["kind"];
const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "emergency_target", label: "Emergency fund target", hint: "How many months of essential spending you want in reserve. Used in plans, stress tests and purchase reviews." },
  { kind: "uncertainty_tolerance", label: "Planning for uncertainty", hint: "Cautious widens the spending range in projections; comfortable narrows it." },
  { kind: "category_priority", label: "Spending priority", hint: "What matters to you, and what you'd cut first. Used in stress-test steps and purchase reviews." },
  { kind: "budgeting_method", label: "Budgeting method", hint: "Shapes how the advisor talks about your budget." },
  { kind: "savings_milestone", label: "Savings milestone", hint: "A milestone you want the advisor to keep in mind." },
  { kind: "research_interest", label: "Research interests", hint: "Topics and tickers. Saved articles that mention these tickers show up in Opportunities." },
  { kind: "note", label: "Something else", hint: "A planning preference in your own words. Don't include account numbers, passwords or health details." },
];
const CATEGORIES = [
  ["housing", "Housing"],
  ["utilities", "Utilities"],
  ["food", "Food & dining"],
  ["transport", "Transportation"],
  ["health", "Health"],
  ["subscriptions", "Subscriptions"],
  ["entertainment", "Entertainment"],
  ["shopping", "Shopping"],
  ["travel", "Travel"],
  ["other", "Other"],
] as const;

interface Draft {
  kind: Kind;
  months: string;
  level: string;
  category: string;
  priority: string;
  method: string;
  text: string;
  amount: string;
  date: string;
  topics: string;
  symbols: string;
}
const blank = (kind: Kind): Draft => ({ kind, months: "3", level: "balanced", category: "travel", priority: "protect", method: "50/30/20", text: "", amount: "", date: "", topics: "", symbols: "" });
function fromValue(v: MemoryValue): Draft {
  const d = blank(v.kind);
  if (v.kind === "emergency_target") d.months = String(v.months);
  if (v.kind === "uncertainty_tolerance") d.level = v.level;
  if (v.kind === "category_priority") Object.assign(d, { category: v.category, priority: v.level });
  if (v.kind === "budgeting_method") d.method = v.method;
  if (v.kind === "savings_milestone") Object.assign(d, { text: v.text, amount: v.amountCents ? (v.amountCents / 100).toFixed(2) : "", date: v.date ?? "" });
  if (v.kind === "research_interest") Object.assign(d, { topics: v.topics.join(", "), symbols: v.symbols.join(", ") });
  if (v.kind === "note") d.text = v.text;
  return d;
}
function toValue(d: Draft): MemoryValue | string {
  switch (d.kind) {
    case "emergency_target": {
      const m = Number(d.months);
      return Number.isFinite(m) && m >= 0 && m <= 24 ? { kind: d.kind, months: m } : "Enter 0–24 months.";
    }
    case "uncertainty_tolerance":
      return { kind: d.kind, level: d.level as "balanced" };
    case "category_priority":
      return { kind: d.kind, category: d.category as "travel", level: d.priority as "protect" };
    case "budgeting_method":
      return { kind: d.kind, method: d.method as "50/30/20" };
    case "savings_milestone": {
      const amt = d.amount.trim() ? toCents(d.amount) : null;
      if (d.amount.trim() && !amt) return "Check the amount.";
      return d.text.trim() ? { kind: d.kind, text: d.text.trim(), amountCents: amt, date: d.date || null } : "Describe the milestone.";
    }
    case "research_interest": {
      const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      return { kind: d.kind, topics: split(d.topics), symbols: split(d.symbols).map((x) => x.toUpperCase().replace("$", "")) };
    }
    case "note":
      return d.text.trim() ? { kind: d.kind, text: d.text.trim() } : "Write something to remember.";
  }
}

export function MemoryView({ initial }: { initial: { enabled: boolean; items: SerializedMemory[]; limit: number } }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [items, setItems] = useState(initial.items);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleAll(next: boolean) {
    setEnabled(next);
    try {
      await api("/api/memory/settings", { method: "PATCH", body: { enabled: next } });
      toast(next ? "Memory is on. The advisor and plans use your enabled preferences." : "Memory is off. Nothing saved here is used until you turn it back on.");
    } catch {
      setEnabled(!next);
    }
  }
  async function save() {
    if (!editing) return;
    const v = toValue(editing.draft);
    if (typeof v === "string") return setError(v);
    setSaving(true);
    setError(null);
    try {
      if (editing.id) {
        const r = await api<{ item: SerializedMemory }>(`/api/memory/${editing.id}`, { method: "PATCH", body: { value: v } });
        setItems((xs) => xs.map((x) => (x.id === r.item.id ? r.item : x)));
      } else {
        const r = await api<{ item: SerializedMemory }>("/api/memory", { body: v });
        setItems((xs) => [...xs.filter((x) => x.id !== r.item.id), r.item]);
      }
      setEditing(null);
      toast("Saved to memory.");
    } catch (e) {
      setError(e instanceof ApiError ? (e.fields[0]?.message ?? e.message) : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }
  async function setItemEnabled(m: SerializedMemory, on: boolean) {
    const r = await api<{ item: SerializedMemory }>(`/api/memory/${m.id}`, { method: "PATCH", body: { enabled: on } });
    setItems((xs) => xs.map((x) => (x.id === m.id ? r.item : x)));
  }
  const d = editing?.draft;
  const set = (p: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));
  const groups = KINDS.map((k) => ({ ...k, items: items.filter((i) => i.kind === k.kind) })).filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-start gap-4 p-5">
        <span className="grid size-11 place-items-center rounded-[14px] bg-gradient-to-br from-blue/25 to-violet/25 text-cyan">
          <Brain className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Financial memory is {enabled ? "on" : "off"}</p>
          <p className="mt-0.5 text-sm text-ink2">
            Things you choose to save here give the advisor and your plans continuity across sessions. Only enabled items are used, only for your account, and VELTRIX never adds anything here on its own; the advisor can suggest a memory, and you confirm it.
          </p>
        </div>
        <button role="switch" aria-checked={enabled} aria-label="Use financial memory" onClick={() => toggleAll(!enabled)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-blue" : "bg-white/15"}`}>
          <span className={`absolute top-1 size-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <Card title="Add something to remember">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k.kind} onClick={() => { setError(null); setEditing({ id: null, draft: blank(k.kind) }); }} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg2 px-3 py-1.5 text-xs text-ink2 hover:border-blue hover:text-ink">
              <Plus className="size-3.5" aria-hidden /> {k.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink3">
          Or tell the advisor: “Remember that travel matters to me.” Your reserve target here is the same one used in the <Link href="/app/plan?tab=assumptions" className="text-cyan hover:underline">What-if Lab assumptions</Link>.
        </p>
      </Card>

      {items.length === 0 ? (
        <EmptyState icon={<Brain className="size-5" />} title="Nothing saved yet" body="Save a reserve target, what matters to you, or how cautious you'd like plans to be, and VELTRIX will use it everywhere it's relevant." />
      ) : (
        <div className={`space-y-4 ${enabled ? "" : "opacity-60"}`}>
          {groups.map((g) => (
            <Card key={g.kind} title={g.label}>
              <ul className="divide-y divide-line-soft">
                {g.items.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <input type="checkbox" className="size-4 accent-[#3B82F6]" checked={m.enabled} onChange={(e) => setItemEnabled(m, e.target.checked)} aria-label={`Use: ${m.text}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${m.enabled ? "" : "text-ink3 line-through"}`}>{m.text}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-ink3">
                        <span>{m.source === "advisor" ? "Saved by you via the advisor" : "Saved by you"} · {relativeTime(m.updatedAt)}</span>
                        <span>{m.lastUsedAt ? `Last used ${relativeTime(m.lastUsedAt)}` : "Not used yet"}</span>
                      </p>
                    </div>
                    {!m.enabled && <Badge tone="neutral">Off</Badge>}
                    <Button size="sm" variant="ghost" aria-label={`Edit: ${m.text}`} onClick={() => { setError(null); setEditing({ id: m.id, draft: fromValue(m.value) }); }}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <ConfirmButton
                      title="Forget this?"
                      body={m.text}
                      confirmLabel="Forget"
                      ariaLabel={`Delete: ${m.text}`}
                      onConfirm={async () => {
                        await api(`/api/memory/${m.id}`, { method: "DELETE" });
                        setItems((xs) => xs.filter((x) => x.id !== m.id));
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </ConfirmButton>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-ink3">
              <ShieldCheck className="size-3.5" aria-hidden /> {items.length} of {initial.limit} items. Included in your data export; deleted with your account.
            </p>
            <ConfirmButton
              title="Forget everything?"
              body="All saved preferences are permanently deleted. Your accounts, plans and transactions aren't affected."
              confirmLabel="Forget everything"
              onConfirm={async () => {
                await api("/api/memory", { method: "DELETE" });
                setItems([]);
              }}
            >
              Forget everything
            </ConfirmButton>
          </div>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit memory" : `Remember: ${KINDS.find((k) => k.kind === d?.kind)?.label ?? ""}`} description={KINDS.find((k) => k.kind === d?.kind)?.hint}>
        {d && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {d.kind === "emergency_target" && (
              <Field label="Months of essential spending" htmlFor="m-months">
                <Input id="m-months" type="number" min={0} max={24} step={0.5} value={d.months} onChange={(e) => set({ months: e.target.value })} />
              </Field>
            )}
            {d.kind === "uncertainty_tolerance" && (
              <Field label="How should plans treat uncertainty?" htmlFor="m-level">
                <Select id="m-level" value={d.level} onChange={(e) => set({ level: e.target.value })}>
                  <option value="cautious">Cautious: assume spending can run higher</option>
                  <option value="balanced">Balanced</option>
                  <option value="comfortable">Comfortable: use a narrower range</option>
                </Select>
              </Field>
            )}
            {d.kind === "category_priority" && (
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Category" htmlFor="m-cat">
                  <Select id="m-cat" value={d.category} onChange={(e) => set({ category: e.target.value })}>
                    {CATEGORIES.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="It's…" htmlFor="m-pri">
                  <Select id="m-pri" value={d.priority} onChange={(e) => set({ priority: e.target.value })}>
                    <option value="protect">Important to me</option>
                    <option value="flexible">Flexible: I&apos;d cut it first</option>
                  </Select>
                </Field>
              </div>
            )}
            {d.kind === "budgeting_method" && (
              <Field label="Method" htmlFor="m-method">
                <Select id="m-method" value={d.method} onChange={(e) => set({ method: e.target.value })}>
                  <option value="50/30/20">50/30/20 (needs / wants / saving)</option>
                  <option value="zero_based">Zero-based (every dollar assigned)</option>
                  <option value="envelope">Envelope (fixed amounts per category)</option>
                  <option value="pay_yourself_first">Pay yourself first</option>
                  <option value="none">No particular method</option>
                </Select>
              </Field>
            )}
            {d.kind === "savings_milestone" && (
              <>
                <Field label="Milestone" htmlFor="m-text">
                  <Input id="m-text" maxLength={120} value={d.text} onChange={(e) => set({ text: e.target.value })} placeholder="Have a full year of rent saved" />
                </Field>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Amount (optional)" htmlFor="m-amt">
                    <DollarInput id="m-amt" value={d.amount} onChange={(v) => set({ amount: v })} />
                  </Field>
                  <Field label="By (optional)" htmlFor="m-date">
                    <Input id="m-date" type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} />
                  </Field>
                </div>
              </>
            )}
            {d.kind === "research_interest" && (
              <>
                <Field label="Topics (comma separated)" htmlFor="m-topics">
                  <Input id="m-topics" value={d.topics} onChange={(e) => set({ topics: e.target.value })} placeholder="index funds, clean energy" />
                </Field>
                <Field label="Tickers (comma separated)" htmlFor="m-sym">
                  <Input id="m-sym" value={d.symbols} onChange={(e) => set({ symbols: e.target.value })} placeholder="VOO, NVDA" />
                </Field>
              </>
            )}
            {d.kind === "note" && (
              <Field label="In your own words" htmlFor="m-note">
                <Textarea id="m-note" maxLength={300} value={d.text} onChange={(e) => set({ text: e.target.value })} placeholder="I get paid every other Friday." />
              </Field>
            )}
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
