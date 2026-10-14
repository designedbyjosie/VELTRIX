"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgePercent, Gift, Plus } from "lucide-react";
import { Badge, Button, Card, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Modal, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, relativeTime, shortDate } from "@/lib/format";

export interface DealView {
  id: string;
  title: string;
  merchant: string;
  url: string;
  currency: string;
  priceCents: number | null;
  previousPriceCents: number | null;
  savingsCents: number | null;
  couponCode: string | null;
  couponConditions: string | null;
  cashbackRate: number | null;
  shippingCents: number | null;
  totalCents: number | null;
  verification: "VERIFIED" | "UNVERIFIED" | "USER_REPORTED" | "EXPIRED";
  confidence: string;
  source: string;
  lastCheckedAt: string;
  expiresAt: string | null;
}
export interface RewardView {
  id: string;
  name: string;
  programType: string;
  balance: number;
  pointValueCents: number | null;
  estimatedValueCents: number | null;
  expiresAt: string | null;
  source: string;
  updatedAt: string;
}

const VERIFY: Record<DealView["verification"], { tone: "pos" | "neutral" | "warn" | "neg"; label: string; title: string }> = {
  VERIFIED: { tone: "pos", label: "Verified", title: "Both prices were observed and recorded by VELTRIX." },
  UNVERIFIED: { tone: "warn", label: "Unverified", title: "Not confirmed. Check the merchant's site." },
  USER_REPORTED: { tone: "neutral", label: "Added by you", title: "Entered manually; VELTRIX hasn't verified it." },
  EXPIRED: { tone: "neg", label: "Expired", title: "Past its expiry date." },
};

function DealForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const v = (k: string) => String(f.get(k) ?? "").trim() || null;
        setBusy(true);
        setError(null);
        try {
          await api("/api/deals", { body: { title: v("title"), merchant: v("merchant"), url: v("url"), price: v("price")?.replace(/[$,]/g, "") ?? null, couponCode: v("couponCode"), couponConditions: v("couponConditions"), cashbackRate: v("cashbackRate"), shippingCost: v("shippingCost")?.replace(/[$,]/g, "") ?? null, expiresAt: v("expiresAt") } });
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <FormError message={error.fields.length ? error.fields.map((f) => `${f.path}: ${f.message}`).join(" ") : error.message} />}
      <Field label="Offer" htmlFor="d-title">
        <Input id="d-title" name="title" required placeholder="20% off running shoes" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Merchant" htmlFor="d-merchant">
          <Input id="d-merchant" name="merchant" required />
        </Field>
        <Field label="Link" htmlFor="d-url">
          <Input id="d-url" name="url" type="url" required placeholder="https://" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Price" htmlFor="d-price">
          <Input id="d-price" name="price" inputMode="decimal" placeholder="Optional" />
        </Field>
        <Field label="Shipping" htmlFor="d-ship">
          <Input id="d-ship" name="shippingCost" inputMode="decimal" placeholder="Optional" />
        </Field>
        <Field label="Cashback %" htmlFor="d-cb">
          <Input id="d-cb" name="cashbackRate" inputMode="decimal" placeholder="Optional" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Coupon code" htmlFor="d-code">
          <Input id="d-code" name="couponCode" placeholder="Optional" />
        </Field>
        <Field label="Expires" htmlFor="d-exp">
          <Input id="d-exp" name="expiresAt" type="date" />
        </Field>
      </div>
      <Field label="Conditions" htmlFor="d-cond">
        <Input id="d-cond" name="couponConditions" placeholder="Minimum spend, exclusions…" />
      </Field>
      <p className="text-xs text-ink3">Deals you add are labeled “Added by you” — VELTRIX doesn&apos;t verify coupons or cashback rates.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Save deal
        </Button>
      </div>
    </form>
  );
}

function RewardForm({ reward, onDone }: { reward?: RewardView; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = { name: String(f.get("name")), programType: String(f.get("programType")), balance: String(f.get("balance")).replace(/,/g, ""), pointValueCents: String(f.get("cpp")) || null, expiresAt: String(f.get("expiresAt")) || null };
        setBusy(true);
        setError(null);
        try {
          if (reward) await api(`/api/rewards/${reward.id}`, { method: "PATCH", body });
          else await api("/api/rewards", { body });
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <FormError message={error.fields.length ? error.fields.map((f) => f.message).join(" ") : error.message} />}
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <Field label="Program" htmlFor="r-name">
          <Input id="r-name" name="name" required defaultValue={reward?.name} placeholder="Airline miles" />
        </Field>
        <Field label="Type" htmlFor="r-type">
          <Select id="r-type" name="programType" defaultValue={reward?.programType ?? "CARD"}>
            {["AIRLINE", "HOTEL", "CARD", "RETAIL", "OTHER"].map((t) => (
              <option key={t} value={t}>
                {t[0] + t.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Points balance" htmlFor="r-bal">
          <Input id="r-bal" name="balance" inputMode="numeric" required defaultValue={reward?.balance} />
        </Field>
        <Field label="Value (¢/point)" htmlFor="r-cpp" hint="Your own estimate">
          <Input id="r-cpp" name="cpp" inputMode="decimal" defaultValue={reward?.pointValueCents ?? ""} placeholder="1.0" />
        </Field>
        <Field label="Expires" htmlFor="r-exp">
          <Input id="r-exp" name="expiresAt" type="date" defaultValue={reward?.expiresAt ?? ""} />
        </Field>
      </div>
      <p className="text-xs text-ink3">Never enter your membership number or login. VELTRIX can&apos;t redeem points; values are estimates based on the rate you enter.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}

export function DealsView({ deals, rewards }: { deals: DealView[]; rewards: RewardView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [addingDeal, setAddingDeal] = useState(false);
  const [rewardModal, setRewardModal] = useState<RewardView | "new" | null>(null);
  const totalRewards = rewards.reduce((s, r) => s + (r.estimatedValueCents ?? 0), 0);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card title="Deals" action={<Button size="sm" variant="primary" onClick={() => setAddingDeal(true)}><Plus className="size-4" /> Add deal</Button>}>
        {deals.length === 0 ? (
          <EmptyState icon={<BadgePercent className="size-5" />} title="No deals yet" body="When the price of a product you saved drops, VELTRIX records a verified deal here. You can also add coupons you find." />
        ) : (
          <ul className="space-y-3">
            {deals.map((d) => {
              const v = VERIFY[d.verification];
              return (
                <li key={d.id} className={`panel-inner p-4 ${d.verification === "EXPIRED" ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <a href={d.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:text-cyan">
                        {d.title}
                      </a>
                      <p className="text-xs text-ink3">
                        {d.merchant} · checked {relativeTime(d.lastCheckedAt)}
                        {d.expiresAt ? ` · expires ${shortDate(d.expiresAt)}` : ""}
                      </p>
                    </div>
                    <Badge tone={v.tone} title={v.title}>
                      {v.label}
                    </Badge>
                    {d.source === "DEMO" && <DemoBadge />}
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                    {d.priceCents !== null && <span className="num font-semibold">{money(d.priceCents, d.currency)}</span>}
                    {d.previousPriceCents !== null && <span className="num text-ink3 line-through">{money(d.previousPriceCents, d.currency)}</span>}
                    {d.savingsCents !== null && d.savingsCents > 0 && <span className="num text-pos">save {money(d.savingsCents, d.currency)}</span>}
                    {d.shippingCents !== null && <span className="text-xs text-ink2">+ {money(d.shippingCents, d.currency)} shipping = {money(d.totalCents, d.currency)}</span>}
                    {d.couponCode && <Badge tone="violet">Code {d.couponCode}</Badge>}
                    {d.cashbackRate !== null && <Badge tone="info">{d.cashbackRate}% cashback (unverified)</Badge>}
                  </div>
                  {d.couponConditions && <p className="mt-1 text-xs text-ink3">{d.couponConditions}</p>}
                  <div className="mt-2 flex justify-end">
                    <ConfirmButton
                      title="Remove this deal?"
                      confirmLabel="Remove"
                      onConfirm={async () => {
                        await api(`/api/deals/${d.id}`, { method: "DELETE" });
                        toast("Deal removed");
                        router.refresh();
                      }}
                    >
                      Remove
                    </ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title="Rewards & loyalty" action={<Button size="sm" onClick={() => setRewardModal("new")}><Plus className="size-4" /> Add program</Button>}>
        {rewards.length === 0 ? (
          <EmptyState icon={<Gift className="size-5" />} title="Track points and miles" body="Add loyalty balances to see an estimated value using the rate you choose." />
        ) : (
          <>
            <p className="text-xs text-ink3">Estimated total value (your valuations)</p>
            <p className="num mb-3 font-display text-2xl font-semibold">{money(totalRewards)}</p>
            <ul className="divide-y divide-line-soft">
              {rewards.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {r.name} {r.source === "DEMO" && <DemoBadge label="Demo" />}
                    </p>
                    <p className="text-xs text-ink3">
                      {r.balance.toLocaleString()} points · {r.pointValueCents !== null ? `${r.pointValueCents}¢ each` : "no valuation set"}
                      {r.expiresAt ? ` · expires ${shortDate(r.expiresAt)}` : ""}
                    </p>
                  </div>
                  <p className="num text-sm">{r.estimatedValueCents !== null ? money(r.estimatedValueCents) : "—"}</p>
                  <Button size="sm" variant="ghost" onClick={() => setRewardModal(r)}>
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <Modal open={addingDeal} onClose={() => setAddingDeal(false)} title="Add a deal" wide>
        <DealForm onDone={() => { setAddingDeal(false); toast("Deal saved"); router.refresh(); }} />
      </Modal>
      <Modal open={!!rewardModal} onClose={() => setRewardModal(null)} title={rewardModal === "new" ? "Add a rewards program" : "Edit rewards program"}>
        {rewardModal && (
          <>
            <RewardForm reward={rewardModal === "new" ? undefined : rewardModal} onDone={() => { setRewardModal(null); router.refresh(); }} />
            {rewardModal !== "new" && (
              <div className="mt-3 border-t border-line-soft pt-3">
                <ConfirmButton
                  title={`Delete ${rewardModal.name}?`}
                  onConfirm={async () => {
                    await api(`/api/rewards/${rewardModal.id}`, { method: "DELETE" });
                    setRewardModal(null);
                    router.refresh();
                  }}
                >
                  Delete program
                </ConfirmButton>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
