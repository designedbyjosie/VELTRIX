"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Filter, Plus, Upload } from "lucide-react";
import { Badge, Button, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Modal, Select, Spinner, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, shortDate, titleCase } from "@/lib/format";
import { CsvImport } from "./csv-import";

export interface Category {
  id: string;
  slug: string;
  name: string;
  kind: string;
  color: string;
}
export interface Account {
  id: string;
  name: string;
  mask: string;
}
interface Txn {
  id: string;
  date: string;
  amountCents: number;
  currency: string;
  merchant: string;
  description: string;
  notes: string;
  category: { id: string; slug: string; name: string; color: string; kind: string } | null;
  categorySource: string;
  account: { id: string; name: string; mask: string } | null;
  source: string;
  importBatchId: string | null;
  createdAt: string;
}
interface ListResponse {
  items: Txn[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  netByCurrency: { currency: string; netCents: number }[];
}

const FILTER_KEYS = ["q", "categoryId", "accountId", "from", "to", "type", "min", "max", "page"] as const;

function TxnForm({ txn, categories, accounts, onDone }: { txn?: Txn; categories: Category[]; accounts: Account[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [direction, setDirection] = useState<"expense" | "income">(txn && txn.amountCents > 0 ? "income" : "expense");
  const toast = useToast();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const raw = String(f.get("amount")).replace(/[$,\s-]/g, "");
        const body = {
          date: String(f.get("date")),
          amount: direction === "expense" ? `-${raw}` : raw,
          merchant: String(f.get("merchant")),
          description: String(f.get("description") ?? ""),
          categoryId: String(f.get("categoryId")) || null,
          accountId: String(f.get("accountId")) || null,
          notes: String(f.get("notes") ?? ""),
        };
        setBusy(true);
        setError(null);
        try {
          if (txn) await api(`/api/transactions/${txn.id}`, { method: "PATCH", body });
          else await api("/api/transactions", { body });
          toast(txn ? "Transaction updated" : "Transaction added");
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && !error.fields.length && <FormError message={error.message} />}
      <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((d) => (
          <button key={d} type="button" role="radio" aria-checked={direction === d} onClick={() => setDirection(d)} className={`rounded-[10px] border px-3 py-2 text-sm capitalize ${direction === d ? "border-blue bg-blue/15 text-ink" : "border-line text-ink2"}`}>
            {d === "expense" ? "Money out" : "Money in"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" htmlFor="t-amount" error={error?.fieldError("amount")}>
          <Input id="t-amount" name="amount" inputMode="decimal" required defaultValue={txn ? (Math.abs(txn.amountCents) / 100).toFixed(2) : ""} placeholder="0.00" />
        </Field>
        <Field label="Date" htmlFor="t-date" error={error?.fieldError("date")}>
          <Input id="t-date" name="date" type="date" required defaultValue={txn?.date ?? new Date().toISOString().slice(0, 10)} />
        </Field>
      </div>
      <Field label="Merchant or payee" htmlFor="t-merchant" error={error?.fieldError("merchant")}>
        <Input id="t-merchant" name="merchant" required defaultValue={txn?.merchant} placeholder="e.g. Whole Foods Market" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="t-cat" hint={!txn ? "Leave on Automatic to apply VELTRIX's rules." : undefined}>
          <Select id="t-cat" name="categoryId" defaultValue={txn?.category?.id ?? ""}>
            <option value="">{txn ? "Uncategorized" : "Automatic"}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Account" htmlFor="t-acc">
          <Select id="t-acc" name="accountId" defaultValue={txn?.account?.id ?? ""}>
            <option value="">No account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.mask ? ` ••${a.mask}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="t-notes">
        <Input id="t-notes" name="notes" defaultValue={txn?.notes} placeholder="Optional" />
      </Field>
      <input type="hidden" name="description" value={txn?.description ?? ""} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {txn ? "Save changes" : "Add transaction"}
        </Button>
      </div>
    </form>
  );
}

export function TransactionsView({ categories, accounts, initial }: { categories: Category[]; accounts: Account[]; initial: ListResponse }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(params.get("import") === "1");
  const [selected, setSelected] = useState<Txn | null>(null);
  const [editing, setEditing] = useState<Txn | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const toast = useToast();

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<(typeof FILTER_KEYS)[number], string>;

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    for (const k of FILTER_KEYS) if (params.get(k)) qs.set(k, params.get(k)!);
    setLoading(true);
    try {
      setData(await api<ListResponse>(`/api/transactions?${qs}`));
    } catch {
      toast("Couldn't load transactions.", "neg");
    } finally {
      setLoading(false);
    }
  }, [params, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (patch: Partial<Record<(typeof FILTER_KEYS)[number], string>>) => {
    const qs = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) qs.set(k, v);
      else qs.delete(k);
    }
    if (!("page" in patch)) qs.delete("page");
    qs.delete("import");
    router.replace(`${pathname}?${qs}`, { scroll: false });
  };

  const activeFilters = FILTER_KEYS.filter((k) => k !== "page" && k !== "q" && filters[k]).length;

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="min-w-[200px] flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter({ q: String(new FormData(e.currentTarget).get("q") ?? "") });
            }}
          >
            <label htmlFor="txn-q" className="sr-only">
              Search transactions
            </label>
            <Input id="txn-q" name="q" defaultValue={filters.q} placeholder="Search merchant, description or notes" />
          </form>
          <Select aria-label="Type" className="w-auto" value={filters.type || "all"} onChange={(e) => setFilter({ type: e.target.value === "all" ? "" : e.target.value })}>
            <option value="all">All</option>
            <option value="expense">Money out</option>
            <option value="income">Money in</option>
          </Select>
          <Select aria-label="Category" className="w-auto" value={filters.categoryId} onChange={(e) => setFilter({ categoryId: e.target.value })}>
            <option value="">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button variant={activeFilters ? "secondary" : "ghost"} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            <Filter className="size-4" aria-hidden /> More{activeFilters ? ` (${activeFilters})` : ""}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => setImporting(true)}>
              <Upload className="size-4" aria-hidden /> Import CSV
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Add
            </Button>
          </div>
        </div>
        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-line-soft pt-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="From" htmlFor="f-from">
              <Input id="f-from" type="date" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} />
            </Field>
            <Field label="To" htmlFor="f-to">
              <Input id="f-to" type="date" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} />
            </Field>
            <Field label="Account" htmlFor="f-acc">
              <Select id="f-acc" value={filters.accountId} onChange={(e) => setFilter({ accountId: e.target.value })}>
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Min amount" htmlFor="f-min">
              <Input id="f-min" inputMode="decimal" defaultValue={filters.min} onBlur={(e) => setFilter({ min: e.target.value.replace(/[$,]/g, "") })} placeholder="0.00" />
            </Field>
            <Field label="Max amount" htmlFor="f-max">
              <Input id="f-max" inputMode="decimal" defaultValue={filters.max} onBlur={(e) => setFilter({ max: e.target.value.replace(/[$,]/g, "") })} placeholder="0.00" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button size="sm" variant="ghost" onClick={() => router.replace(pathname)}>
                Clear all filters
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3 text-sm">
          <p className="text-ink2">
            {data.total.toLocaleString()} transaction{data.total === 1 ? "" : "s"}
            {data.netByCurrency.map((n) => (
              <span key={n.currency} className="ml-3">
                net <span className={`num ${n.netCents >= 0 ? "text-pos" : "text-ink"}`}>{money(n.netCents, n.currency, { showSign: true })}</span>
              </span>
            ))}
          </p>
          {loading && <Spinner className="size-4" />}
        </div>
        {data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<ArrowLeftRight className="size-5" />} title={activeFilters || filters.q ? "No transactions match these filters" : "No transactions yet"} body={activeFilters || filters.q ? "Try widening the date range or clearing filters." : "Add one manually or import a CSV export from your bank."} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-ink3">
                <tr className="border-b border-line-soft">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Merchant</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <tr key={t.id} className="cursor-pointer border-b border-line-soft/60 hover:bg-white/[0.03]" onClick={() => setSelected(t)}>
                    <td className="num whitespace-nowrap px-4 py-2.5 text-ink2">{shortDate(t.date, { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-4 py-2.5">
                      <button className="text-left font-medium text-ink hover:text-cyan" onClick={(e) => { e.stopPropagation(); setSelected(t); }}>
                        {t.merchant}
                      </button>
                      {t.source === "DEMO" && <span className="ml-2"><DemoBadge label="Demo" /></span>}
                      {t.source === "CSV" && <span className="ml-2"><Badge>CSV</Badge></span>}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <label className="sr-only" htmlFor={`cat-${t.id}`}>
                        Category for {t.merchant}
                      </label>
                      <select
                        id={`cat-${t.id}`}
                        value={t.category?.id ?? ""}
                        onChange={async (e) => {
                          try {
                            await api(`/api/transactions/${t.id}`, { method: "PATCH", body: { categoryId: e.target.value || null } });
                            toast("Category updated");
                            load();
                          } catch (err) {
                            toast((err as Error).message, "neg");
                          }
                        }}
                        className="max-w-[160px] rounded-[8px] border border-transparent bg-transparent px-1.5 py-1 text-ink2 hover:border-line focus:border-blue"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-ink3">{t.account ? `${t.account.name}${t.account.mask ? ` ••${t.account.mask}` : ""}` : "—"}</td>
                    <td className={`num whitespace-nowrap px-4 py-2.5 text-right font-medium ${t.amountCents > 0 ? "text-pos" : "text-ink"}`}>{money(t.amountCents, t.currency, { showSign: t.amountCents > 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.pageCount > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between px-4 py-3 text-sm text-ink2">
            <span>
              Page {data.page} of {data.pageCount}
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={data.page <= 1} onClick={() => setFilter({ page: String(data.page - 1) })} aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" disabled={data.page >= data.pageCount} onClick={() => setFilter({ page: String(data.page + 1) })} aria-label="Next page">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </nav>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add transaction">
        <TxnForm categories={categories} accounts={accounts} onDone={() => { setAdding(false); load(); router.refresh(); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit transaction">
        {editing && <TxnForm txn={editing} categories={categories} accounts={accounts} onDone={() => { setEditing(null); setSelected(null); load(); }} />}
      </Modal>
      <Modal open={!!selected && !editing} onClose={() => setSelected(null)} title={selected?.merchant ?? ""} description={selected ? shortDate(selected.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : undefined}>
        {selected && (
          <div className="space-y-4 text-sm">
            <p className={`num font-display text-3xl font-semibold ${selected.amountCents > 0 ? "text-pos" : "text-ink"}`}>{money(selected.amountCents, selected.currency, { showSign: true })}</p>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2">
              <dt className="text-ink3">Category</dt>
              <dd>
                {selected.category?.name ?? "Uncategorized"} <span className="text-xs text-ink3">({selected.categorySource === "RULE" ? "set by VELTRIX rules" : selected.categorySource === "USER" ? "set by you" : selected.categorySource === "IMPORT" ? "from your file" : "default"})</span>
              </dd>
              <dt className="text-ink3">Account</dt>
              <dd>{selected.account?.name ?? "—"}</dd>
              <dt className="text-ink3">Source</dt>
              <dd>{selected.source === "CSV" ? `CSV import (batch ${selected.importBatchId?.slice(-6)})` : selected.source === "DEMO" ? "Demo data" : titleCase(selected.source)}</dd>
              {selected.description && (
                <>
                  <dt className="text-ink3">Description</dt>
                  <dd>{selected.description}</dd>
                </>
              )}
              {selected.notes && (
                <>
                  <dt className="text-ink3">Notes</dt>
                  <dd>{selected.notes}</dd>
                </>
              )}
              <dt className="text-ink3">Recorded</dt>
              <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
            </dl>
            <div className="flex justify-end gap-2">
              <ConfirmButton
                title="Delete this transaction?"
                body="This can't be undone."
                onConfirm={async () => {
                  await api(`/api/transactions/${selected.id}`, { method: "DELETE" });
                  setSelected(null);
                  toast("Transaction deleted");
                  load();
                }}
              >
                Delete
              </ConfirmButton>
              <Button variant="primary" size="sm" onClick={() => setEditing(selected)}>
                Edit
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={importing} onClose={() => setImporting(false)} title="Import transactions from CSV" description="Most bank exports work: we look for Date, Description/Merchant and Amount (or Debit/Credit) columns." wide>
        <CsvImport accounts={accounts} onDone={() => { setImporting(false); load(); router.refresh(); }} />
      </Modal>
    </div>
  );
}
