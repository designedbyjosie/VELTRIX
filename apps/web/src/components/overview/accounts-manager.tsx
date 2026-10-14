"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Landmark, Pencil, Plus } from "lucide-react";
import { accountTypes, LIABILITY_TYPES, SUPPORTED_CURRENCIES, type AccountType } from "@veltrix/shared";
import { Badge, Button, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Modal, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, relativeTime, titleCase } from "@/lib/format";

export interface AccountView {
  id: string;
  name: string;
  institution: string;
  type: string;
  source: string;
  mask: string;
  currency: string;
  balanceCents: number;
  isLiability: boolean;
  balanceAsOf: string;
}

function AccountForm({ account, onDone }: { account?: AccountView; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [type, setType] = useState<AccountType>((account?.type as AccountType) ?? "CHECKING");
  const toast = useToast();
  const router = useRouter();
  const liability = LIABILITY_TYPES.includes(type);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = {
          name: String(f.get("name")),
          institution: String(f.get("institution") ?? ""),
          type,
          currency: String(f.get("currency")),
          balance: String(f.get("balance")).replace(/[$,\s]/g, ""),
          mask: String(f.get("mask") ?? ""),
        };
        setBusy(true);
        setError(null);
        try {
          if (account) await api(`/api/accounts/${account.id}`, { method: "PATCH", body });
          else await api("/api/accounts", { body });
          toast(account ? "Account updated" : "Account added");
          router.refresh();
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && !error.fields.length && <FormError message={error.message} />}
      <Field label="Account name" htmlFor="acc-name" error={error?.fieldError("name")}>
        <Input id="acc-name" name="name" defaultValue={account?.name} placeholder="Everyday Checking" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="acc-type">
          <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {accountTypes.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Institution" htmlFor="acc-inst">
          <Input id="acc-inst" name="institution" defaultValue={account?.institution} placeholder="Optional" />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_110px_100px] gap-3">
        <Field label={liability ? "Amount owed" : "Current balance"} htmlFor="acc-bal" error={error?.fieldError("balance")}>
          <Input id="acc-bal" name="balance" inputMode="decimal" defaultValue={account ? (account.balanceCents / 100).toFixed(2) : ""} placeholder="0.00" required />
        </Field>
        <Field label="Currency" htmlFor="acc-cur">
          <Select id="acc-cur" name="currency" defaultValue={account?.currency ?? "USD"}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Last 4" htmlFor="acc-mask" error={error?.fieldError("mask")}>
          <Input id="acc-mask" name="mask" defaultValue={account?.mask} maxLength={4} inputMode="numeric" placeholder="1234" />
        </Field>
      </div>
      <p className="text-xs text-ink3">Never enter full account numbers or bank passwords. VELTRIX only needs a name and a balance.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {account ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}

export function AccountsManager({ accounts }: { accounts: AccountView[] }) {
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AccountView | null>(null);
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (params.get("new") === "1") setAdding(true);
  }, [params]);
  const groups = [
    { label: "Assets", items: accounts.filter((a) => !a.isLiability) },
    { label: "Liabilities", items: accounts.filter((a) => a.isLiability) },
  ];
  return (
    <section className="panel">
      <header className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-[15px] font-semibold">Accounts</h2>
        <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Add account
        </Button>
      </header>
      <div className="p-5 pt-3">
        {accounts.length === 0 ? (
          <EmptyState icon={<Landmark className="size-5" />} title="No accounts yet" body="Add checking, savings, credit cards, loans, investments or property to calculate your net worth." action={<Button variant="primary" size="sm" onClick={() => setAdding(true)}>Add your first account</Button>} />
        ) : (
          <div className="space-y-5">
            {groups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.label}>
                    <p className="mb-2 text-xs font-medium text-ink3">{g.label}</p>
                    <ul className="divide-y divide-line-soft rounded-[12px] border border-line-soft">
                      {g.items.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {a.name} {a.mask && <span className="text-xs text-ink3">•••• {a.mask}</span>}
                              {a.source === "DEMO" && <DemoBadge />}
                              {a.currency !== "USD" && <Badge>{a.currency}</Badge>}
                            </p>
                            <p className="text-xs text-ink3">
                              {titleCase(a.type)}
                              {a.institution ? ` · ${a.institution}` : ""} · updated {relativeTime(a.balanceAsOf)} · {a.source === "MANUAL" ? "entered manually" : a.source === "AGGREGATOR" ? "synced from your bank" : titleCase(a.source)}
                            </p>
                          </div>
                          <p className={`num text-right font-semibold ${a.isLiability ? "text-neg" : "text-ink"}`}>
                            {a.isLiability ? "−" : ""}
                            {money(a.balanceCents, a.currency)}
                          </p>
                          {a.source === "AGGREGATOR" ? (
                            <Badge tone="info" title="Balance and transactions sync from your bank. Manage it under Bank connections.">Linked</Badge>
                          ) : (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <ConfirmButton
                              title={`Delete ${a.name}?`}
                              body="The account and its balance history are removed. Transactions stay but are no longer linked to it."
                              ariaLabel={`Delete ${a.name}`}
                              onConfirm={async () => {
                                await api(`/api/accounts/${a.id}`, { method: "DELETE" });
                                toast("Account deleted");
                                router.refresh();
                              }}
                            >
                              Delete
                            </ConfirmButton>
                          </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </div>
        )}
      </div>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add an account" description="Balances are entered manually. Bank connections require an aggregation provider (not configured).">
        <AccountForm onDone={() => setAdding(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit account" description="Updating the balance records a new point in your net worth history.">
        {editing && <AccountForm account={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </section>
  );
}
