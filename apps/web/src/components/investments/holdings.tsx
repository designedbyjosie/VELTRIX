"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChartLine, Plus } from "lucide-react";
import { Button, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Modal, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";

export interface HoldingView {
  id: string;
  accountName: string;
  symbol: string;
  name: string;
  type: string;
  quantity: string;
  costBasisCents: number;
  price: number | null;
  priceAsOf: string | null;
  changePercent: number | null;
  marketValueCents: number | null;
  unrealizedGainCents: number | null;
  source: string;
}

export function Holdings({ holdings, accounts, currency }: { holdings: HoldingView[]; accounts: { id: string; name: string }[]; currency: string }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const router = useRouter();
  const toast = useToast();
  return (
    <section className="panel">
      <header className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-[15px] font-semibold">Holdings</h2>
        <Button size="sm" variant="primary" onClick={() => setAdding(true)} disabled={!accounts.length} title={accounts.length ? undefined : "Add an investment account first"}>
          <Plus className="size-4" /> Add holding
        </Button>
      </header>
      <div className="p-5 pt-3">
        {holdings.length === 0 ? (
          <EmptyState icon={<ChartLine className="size-5" />} title="No holdings recorded" body={accounts.length ? "Add the positions you hold to see allocation, gains and concentration." : "Create an Investment or Retirement account on the Financial Overview page first."} action={!accounts.length ? <Link href="/app/overview?new=1" className="text-sm text-cyan hover:underline">Add an account</Link> : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-ink3">
                <tr className="border-b border-line-soft">
                  <th className="py-2 font-medium">Symbol</th>
                  <th className="py-2 font-medium">Account</th>
                  <th className="py-2 text-right font-medium">Quantity</th>
                  <th className="py-2 text-right font-medium">Price</th>
                  <th className="py-2 text-right font-medium">Value</th>
                  <th className="py-2 text-right font-medium">Cost basis</th>
                  <th className="py-2 text-right font-medium">Unrealized</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.id} className="border-b border-line-soft/60">
                    <td className="py-2.5">
                      <Link href={`/app/markets/${h.symbol}`} className="font-semibold text-ink hover:text-cyan">
                        {h.symbol}
                      </Link>
                      <span className="ml-2 text-xs text-ink3">{h.name}</span> {h.source === "DEMO" && <DemoBadge label="Demo" />}
                    </td>
                    <td className="py-2.5 text-ink2">{h.accountName}</td>
                    <td className="num py-2.5 text-right">{Number(h.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    <td className="num py-2.5 text-right">{h.price !== null ? h.price.toFixed(2) : <span className="text-ink3">unavailable</span>}</td>
                    <td className="num py-2.5 text-right font-medium">{money(h.marketValueCents, currency)}</td>
                    <td className="num py-2.5 text-right text-ink2">{money(h.costBasisCents, currency)}</td>
                    <td className={`num py-2.5 text-right ${h.unrealizedGainCents === null ? "" : h.unrealizedGainCents >= 0 ? "text-pos" : "text-neg"}`}>{h.unrealizedGainCents === null ? "—" : money(h.unrealizedGainCents, currency, { showSign: true })}</td>
                    <td className="py-2.5 text-right">
                      <ConfirmButton
                        title={`Remove ${h.symbol} from ${h.accountName}?`}
                        ariaLabel={`Remove ${h.symbol}`}
                        confirmLabel="Remove"
                        onConfirm={async () => {
                          await api(`/api/holdings/${h.id}`, { method: "DELETE" });
                          toast("Holding removed");
                          router.refresh();
                        }}
                      >
                        Remove
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a holding" description="Enter what you hold. If the symbol already exists in that account, it's updated.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError(null);
            try {
              await api("/api/holdings", { body: { accountId: String(f.get("accountId")), symbol: String(f.get("symbol")), quantity: String(f.get("quantity")).replace(/,/g, ""), costBasis: String(f.get("costBasis")).replace(/[$,]/g, "") } });
              toast("Holding saved");
              setAdding(false);
              router.refresh();
            } catch (err) {
              setError(err as ApiError);
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && !error.fields.length && <FormError message={error.message} />}
          <Field label="Account" htmlFor="h-acc">
            <Select id="h-acc" name="accountId">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Symbol" htmlFor="h-sym" error={error?.fieldError("symbol")}>
              <Input id="h-sym" name="symbol" required placeholder="VOO" className="uppercase" />
            </Field>
            <Field label="Quantity" htmlFor="h-qty" error={error?.fieldError("quantity")}>
              <Input id="h-qty" name="quantity" inputMode="decimal" required placeholder="10" />
            </Field>
            <Field label="Total cost" htmlFor="h-cost" error={error?.fieldError("costBasis")}>
              <Input id="h-cost" name="costBasis" inputMode="decimal" required placeholder="4500.00" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Save holding
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
