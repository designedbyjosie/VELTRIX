"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, Plane, Plus } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@veltrix/shared";
import { Badge, Button, Card, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Modal, Progress, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, shortDate, titleCase } from "@/lib/format";

export interface TripView {
  id: string;
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  budgetCents: number | null;
  currency: string;
  status: "PLANNING" | "BOOKED" | "COMPLETED" | "CANCELLED";
  notes: string;
  source: string;
  spentCents: number;
  quotedCents: number;
  projectedCents: number;
  remainingCents: number | null;
  otherCurrencyCount: number;
  byCategory: { category: string; cents: number }[];
  expenses: { id: string; category: string; description: string; amountCents: number; currency: string; date: string | null; provider: string; isQuote: boolean; sourceUrl: string | null; source: string }[];
}

function TripForm({ trip, onDone }: { trip?: TripView; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body: Record<string, unknown> = {
          name: String(f.get("name")),
          destination: String(f.get("destination")),
          startDate: String(f.get("startDate")) || null,
          endDate: String(f.get("endDate")) || null,
          budget: String(f.get("budget")).replace(/[$,]/g, "") || null,
          currency: String(f.get("currency")),
          notes: String(f.get("notes") ?? ""),
        };
        if (trip) body.status = String(f.get("status"));
        setBusy(true);
        setError(null);
        try {
          if (trip) await api(`/api/trips/${trip.id}`, { method: "PATCH", body });
          else await api("/api/trips", { body });
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <FormError message={error.fields.length ? error.fields.map((f) => f.message).join(" ") : error.message} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Trip name" htmlFor="tr-name">
          <Input id="tr-name" name="name" required defaultValue={trip?.name} placeholder="Japan in spring" />
        </Field>
        <Field label="Destination" htmlFor="tr-dest">
          <Input id="tr-dest" name="destination" required defaultValue={trip?.destination} placeholder="Tokyo" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" htmlFor="tr-start">
          <Input id="tr-start" name="startDate" type="date" defaultValue={trip?.startDate ?? ""} />
        </Field>
        <Field label="End" htmlFor="tr-end">
          <Input id="tr-end" name="endDate" type="date" defaultValue={trip?.endDate ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label="Budget" htmlFor="tr-budget" hint="Optional">
          <Input id="tr-budget" name="budget" inputMode="decimal" defaultValue={trip?.budgetCents ? (trip.budgetCents / 100).toFixed(2) : ""} />
        </Field>
        <Field label="Currency" htmlFor="tr-cur">
          <Select id="tr-cur" name="currency" defaultValue={trip?.currency ?? "USD"}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      {trip && (
        <Field label="Status" htmlFor="tr-status">
          <Select id="tr-status" name="status" defaultValue={trip.status}>
            {["PLANNING", "BOOKED", "COMPLETED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Notes" htmlFor="tr-notes">
        <Input id="tr-notes" name="notes" defaultValue={trip?.notes} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {trip ? "Save trip" : "Create trip"}
        </Button>
      </div>
    </form>
  );
}

function ExpenseForm({ trip, onDone }: { trip: TripView; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isQuote, setIsQuote] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await api(`/api/trips/${trip.id}/expenses`, {
            body: { category: String(f.get("category")), description: String(f.get("description")), amount: String(f.get("amount")).replace(/[$,]/g, ""), currency: trip.currency, date: String(f.get("date")) || null, provider: String(f.get("provider") ?? ""), isQuote },
          });
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <FormError message={error.fields.length ? error.fields.map((f) => f.message).join(" ") : error.message} />}
      <div role="radiogroup" aria-label="Kind" className="grid grid-cols-2 gap-2">
        {[
          { v: false, label: "Money spent" },
          { v: true, label: "Price quote (not booked)" },
        ].map((o) => (
          <button key={o.label} type="button" role="radio" aria-checked={isQuote === o.v} onClick={() => setIsQuote(o.v)} className={`rounded-[10px] border px-3 py-2 text-sm ${isQuote === o.v ? "border-blue bg-blue/15" : "border-line text-ink2"}`}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="ex-cat">
          <Select id="ex-cat" name="category">
            {["FLIGHT", "LODGING", "CAR", "FOOD", "ACTIVITY", "TRANSPORT", "OTHER"].map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Amount (${trip.currency})`} htmlFor="ex-amt">
          <Input id="ex-amt" name="amount" inputMode="decimal" required />
        </Field>
      </div>
      <Field label="Description" htmlFor="ex-desc">
        <Input id="ex-desc" name="description" required placeholder="Hotel, 3 nights" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Provider" htmlFor="ex-prov">
          <Input id="ex-prov" name="provider" placeholder="Optional" />
        </Field>
        <Field label="Date" htmlFor="ex-date">
          <Input id="ex-date" name="date" type="date" />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Add
        </Button>
      </div>
    </form>
  );
}

function CurrencyConverter() {
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");
  const [amount, setAmount] = useState("100");
  const [result, setResult] = useState<{ text: string; note: string } | null>(null);
  return (
    <Card title="Currency conversion" action={<ArrowLeftRight className="size-4 text-ink3" aria-hidden />}>
      <form
        className="grid grid-cols-[1fr_90px_90px_auto] items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await api<{ rate: { rate: number; asOf: string; source: string } | null }>(`/api/fx?from=${from}&to=${to}`);
          if (!r.rate) setResult({ text: "Exchange rates aren't available", note: "No currency data provider is configured (FX_PROVIDER). VELTRIX won't guess a rate." });
          else setResult({ text: `${amount} ${from} = ${(Number(amount) * r.rate.rate).toFixed(2)} ${to}`, note: `Rate ${r.rate.rate} as of ${r.rate.asOf} · ${r.rate.source}. Card and bank rates usually differ.` });
        }}
      >
        <Field label="Amount" htmlFor="fx-amt">
          <Input id="fx-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="From" htmlFor="fx-from">
          <Select id="fx-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="To" htmlFor="fx-to">
          <Select id="fx-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Button type="submit">Convert</Button>
      </form>
      {result && (
        <div className="mt-3">
          <p className="num font-medium">{result.text}</p>
          <p className="text-xs text-ink3">{result.note}</p>
        </div>
      )}
    </Card>
  );
}

export function TravelView({ trips }: { trips: TripView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TripView | null>(null);
  const [addingTo, setAddingTo] = useState<TripView | null>(null);
  const refresh = () => {
    setCreating(false);
    setEditing(null);
    setAddingTo(null);
    router.refresh();
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New trip
          </Button>
        </div>
        {trips.length === 0 ? (
          <div className="panel p-6">
            <EmptyState icon={<Plane className="size-5" />} title="Plan your first trip" body="Set a budget, then record what you spend and the price quotes you're considering. VELTRIX shows the projected total before you book." />
          </div>
        ) : (
          trips.map((t) => {
            const pct = t.budgetCents ? (t.projectedCents / t.budgetCents) * 100 : 0;
            return (
              <Card
                key={t.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {t.name} <Badge tone={t.status === "BOOKED" ? "info" : t.status === "COMPLETED" ? "pos" : t.status === "CANCELLED" ? "neg" : "neutral"}>{titleCase(t.status)}</Badge>
                    {t.source === "DEMO" && <DemoBadge />}
                  </span>
                }
                action={
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => setAddingTo(t)}>
                      <Plus className="size-4" /> Expense
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                      Edit
                    </Button>
                  </div>
                }
              >
                <p className="text-sm text-ink2">
                  {t.destination}
                  {t.startDate ? ` · ${shortDate(t.startDate, { month: "short", day: "numeric", year: "numeric" })}` : ""}
                  {t.endDate ? ` – ${shortDate(t.endDate, { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { l: "Budget", v: t.budgetCents !== null ? money(t.budgetCents, t.currency, { noCents: true }) : "Not set" },
                    { l: "Spent", v: money(t.spentCents, t.currency, { noCents: true }) },
                    { l: "Saved quotes", v: money(t.quotedCents, t.currency, { noCents: true }) },
                    { l: "Projected total", v: money(t.projectedCents, t.currency, { noCents: true }), tone: t.budgetCents !== null && t.projectedCents > t.budgetCents ? "text-warn" : "" },
                  ].map((s) => (
                    <div key={s.l}>
                      <p className="text-xs text-ink3">{s.l}</p>
                      <p className={`num font-display text-lg font-semibold ${s.tone ?? ""}`}>{s.v}</p>
                    </div>
                  ))}
                </div>
                {t.budgetCents !== null && <Progress className="mt-3" value={pct} tone={pct > 100 ? "neg" : pct > 85 ? "warn" : "brand"} label={`${t.name} budget used`} />}
                {t.expenses.length > 0 && (
                  <ul className="mt-4 divide-y divide-line-soft text-sm">
                    {t.expenses.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-2">
                        <Badge>{titleCase(e.category)}</Badge>
                        <span className="min-w-0 flex-1 truncate">
                          {e.description}
                          {e.provider && <span className="text-xs text-ink3"> · {e.provider}</span>}
                        </span>
                        {e.isQuote && <Badge tone="info" title="A price you saw, not money spent">Quote</Badge>}
                        {e.source === "EXTENSION" && <Badge tone="violet">Extension</Badge>}
                        <span className="num">{money(e.amountCents, e.currency)}</span>
                        <ConfirmButton
                          title="Remove this item?"
                          confirmLabel="Remove"
                          ariaLabel={`Remove ${e.description}`}
                          onConfirm={async () => {
                            await api(`/api/trips/${t.id}/expenses/${e.id}`, { method: "DELETE" });
                            router.refresh();
                          }}
                        >
                          ×
                        </ConfirmButton>
                      </li>
                    ))}
                  </ul>
                )}
                {t.otherCurrencyCount > 0 && <p className="mt-2 text-xs text-warn">{t.otherCurrencyCount} item(s) in another currency aren&apos;t included in totals.</p>}
                <div className="mt-3 flex justify-end">
                  <ConfirmButton
                    title={`Delete ${t.name}?`}
                    body="The trip and its expenses are removed."
                    onConfirm={async () => {
                      await api(`/api/trips/${t.id}`, { method: "DELETE" });
                      toast("Trip deleted");
                      router.refresh();
                    }}
                  >
                    Delete trip
                  </ConfirmButton>
                </div>
              </Card>
            );
          })
        )}
      </div>
      <div className="space-y-4">
        <CurrencyConverter />
        <Card title="Travel prices">
          <p className="text-sm text-ink2">Live flight and hotel prices need a travel data provider, which isn&apos;t configured. Meanwhile:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink2">
            <li>Open a flight or hotel page and use the VELTRIX extension to save its price to a trip as a quote.</li>
            <li>Compare quotes against your trip budget before booking.</li>
          </ul>
          <p className="mt-2 text-xs text-ink3">VELTRIX never books travel or redeems rewards.</p>
        </Card>
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="New trip">
        <TripForm onDone={refresh} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit trip">
        {editing && <TripForm trip={editing} onDone={refresh} />}
      </Modal>
      <Modal open={!!addingTo} onClose={() => setAddingTo(null)} title={`Add to ${addingTo?.name ?? ""}`}>
        {addingTo && <ExpenseForm trip={addingTo} onDone={refresh} />}
      </Modal>
    </div>
  );
}
