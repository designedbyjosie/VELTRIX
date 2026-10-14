"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Plus, Puzzle, ShoppingBag } from "lucide-react";
import { Badge, Button, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Modal, Segmented, Select, useToast } from "@/components/ui";
import { PriceLine, Sparkline } from "@/components/charts";
import { api, ApiError } from "@/lib/api";
import { money, relativeTime, shortDate } from "@/lib/format";

export interface ProductView {
  id: string;
  title: string;
  merchant: string;
  url: string;
  imageUrl: string | null;
  currency: string;
  latestPriceCents: number | null;
  latestSeenAt: string | null;
  targetPriceCents: number | null;
  status: "WISHLIST" | "WATCHING" | "PURCHASED" | "ARCHIVED";
  source: string;
  createdAt: string;
  observations: { priceCents: number; observedAt: string; merchant: string; source: string; currency: string }[];
  stats: { count: number; lowCents: number; highCents: number; avgCents: number } | null;
  verdict: { label: string; tone: "positive" | "neutral" | "warning"; basis: string } | null;
}

const toneBadge = { positive: "pos", neutral: "neutral", warning: "warn" } as const;

function ProductDetail({ p, budget, onClose }: { p: ProductView; budget: { remainingCents: number; currency: string } | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-4">
        {p.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt="" className="size-20 rounded-[10px] bg-white object-contain p-1" referrerPolicy="no-referrer" />
        )}
        <div>
          <p className="text-ink2">{p.merchant}</p>
          <p className="num font-display text-2xl font-semibold">{money(p.latestPriceCents, p.currency)}</p>
          <p className="text-xs text-ink3">{p.latestSeenAt ? `last seen ${relativeTime(p.latestSeenAt)}` : "no price recorded"}</p>
          <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs text-cyan hover:underline">
            Open product page <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
      {p.verdict ? (
        <div className="panel-inner p-3">
          <Badge tone={toneBadge[p.verdict.tone]}>{p.verdict.label}</Badge>
          <p className="mt-2 text-xs text-ink3">{p.verdict.basis}</p>
        </div>
      ) : (
        <p className="panel-inner p-3 text-xs text-ink2">{p.observations.length} price{p.observations.length === 1 ? "" : "s"} recorded. A price verdict needs at least 3 observations — VELTRIX doesn&apos;t guess price history.</p>
      )}
      {p.observations.length > 1 && <PriceLine data={p.observations.map((o) => ({ date: o.observedAt.slice(0, 10), close: o.priceCents / 100 }))} currency={p.currency} height={180} />}
      {p.stats && (
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <div><dt className="text-ink3">Lowest seen</dt><dd className="num text-ink">{money(p.stats.lowCents, p.currency)}</dd></div>
          <div><dt className="text-ink3">Average</dt><dd className="num text-ink">{money(p.stats.avgCents, p.currency)}</dd></div>
          <div><dt className="text-ink3">Highest seen</dt><dd className="num text-ink">{money(p.stats.highCents, p.currency)}</dd></div>
        </dl>
      )}
      {budget && p.latestPriceCents !== null && budget.currency === p.currency && (
        <p className={`text-xs ${budget.remainingCents - p.latestPriceCents >= 0 ? "text-ink2" : "text-warn"}`}>
          Shopping budget: {money(budget.remainingCents, budget.currency)} left this month →{" "}
          {budget.remainingCents - p.latestPriceCents >= 0 ? `${money(budget.remainingCents - p.latestPriceCents, budget.currency)} after buying` : `${money(p.latestPriceCents - budget.remainingCents, budget.currency)} over`}
        </p>
      )}
      <form
        className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 border-t border-line-soft pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          try {
            const price = String(f.get("price")).replace(/[$,]/g, "");
            if (price) await api(`/api/products/${p.id}/observations`, { body: { price, currency: p.currency } });
            await api(`/api/products/${p.id}`, { method: "PATCH", body: { status: String(f.get("status")), targetPrice: String(f.get("target")).replace(/[$,]/g, "") || null } });
            toast("Product updated");
            router.refresh();
            onClose();
          } catch (err) {
            setError(err as ApiError);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Record a price you saw" htmlFor="obs-price">
          <Input id="obs-price" name="price" inputMode="decimal" placeholder="e.g. 329.99" />
        </Field>
        <Field label="Target price" htmlFor="obs-target">
          <Input id="obs-target" name="target" inputMode="decimal" defaultValue={p.targetPriceCents ? (p.targetPriceCents / 100).toFixed(2) : ""} placeholder="Notify below" />
        </Field>
        <Select name="status" aria-label="Status" defaultValue={p.status} className="w-auto">
          <option value="WISHLIST">Wishlist</option>
          <option value="WATCHING">Watching</option>
          <option value="PURCHASED">Purchased</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        <div className="col-span-3 flex justify-between">
          <ConfirmButton
            title="Delete this product?"
            body="Its price history is deleted too."
            onConfirm={async () => {
              await api(`/api/products/${p.id}`, { method: "DELETE" });
              toast("Product deleted");
              onClose();
              router.refresh();
            }}
          >
            Delete
          </ConfirmButton>
          <Button type="submit" variant="primary" size="sm" loading={busy}>
            Save
          </Button>
        </div>
      </form>
      {error && <FormError message={error.fields.length ? error.fields.map((f) => f.message).join(" ") : error.message} />}
    </div>
  );
}

function AddProduct({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const toast = useToast();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await api("/api/products", {
            body: { title: String(f.get("title")), merchant: String(f.get("merchant")), url: String(f.get("url")), price: String(f.get("price")).replace(/[$,]/g, "") || null, currency: "USD", targetPrice: String(f.get("target")).replace(/[$,]/g, "") || null, status: "WISHLIST" },
          });
          toast("Saved to wishlist");
          onDone();
        } catch (err) {
          setError(err as ApiError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && !error.fields.length && <FormError message={error.message} />}
      <Field label="Product" htmlFor="p-title" error={error?.fieldError("title")}>
        <Input id="p-title" name="title" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Merchant" htmlFor="p-merchant" error={error?.fieldError("merchant")}>
          <Input id="p-merchant" name="merchant" required />
        </Field>
        <Field label="Price you saw" htmlFor="p-price" error={error?.fieldError("price")}>
          <Input id="p-price" name="price" inputMode="decimal" placeholder="Optional" />
        </Field>
      </div>
      <Field label="Product link" htmlFor="p-url" error={error?.fieldError("url")}>
        <Input id="p-url" name="url" type="url" required placeholder="https://" />
      </Field>
      <Field label="Target price" htmlFor="p-target" error={error?.fieldError("targetPrice")}>
        <Input id="p-target" name="target" inputMode="decimal" placeholder="Optional" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Save product
        </Button>
      </div>
    </form>
  );
}

export function ShoppingView({ products, budget }: { products: ProductView[]; budget: { remainingCents: number; limitCents: number; currency: string } | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<"active" | "PURCHASED" | "ARCHIVED">("active");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(params.get("product"));
  useEffect(() => setOpenId(params.get("product")), [params]);
  const shown = products.filter((p) => (tab === "active" ? p.status === "WISHLIST" || p.status === "WATCHING" : p.status === tab));
  const open = products.find((p) => p.id === openId) ?? null;
  const close = () => {
    setOpenId(null);
    router.replace(pathname, { scroll: false });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filter products"
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: `Wishlist & watching (${products.filter((p) => p.status === "WISHLIST" || p.status === "WATCHING").length})` },
            { value: "PURCHASED", label: "Purchased" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
        />
        <div className="flex items-center gap-3">
          {budget && (
            <p className="text-xs text-ink2">
              Shopping budget: <span className="num text-ink">{money(budget.remainingCents, budget.currency)}</span> of {money(budget.limitCents, budget.currency, { noCents: true })} left
            </p>
          )}
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add product
          </Button>
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="panel p-6">
          <EmptyState
            icon={<ShoppingBag className="size-5" />}
            title={tab === "active" ? "Your wishlist is empty" : "Nothing here yet"}
            body="Save products from any store with the VELTRIX browser extension, or add one manually. VELTRIX records the prices you see so you can tell when a deal is real."
            action={<Link href="/app/settings#extension" className="inline-flex items-center gap-1.5 text-sm text-cyan hover:underline"><Puzzle className="size-4" /> Set up the extension</Link>}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <button key={p.id} onClick={() => setOpenId(p.id)} className="panel flex flex-col p-4 text-left transition hover:border-blue/60">
              <div className="flex items-start gap-3">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="size-14 shrink-0 rounded-[10px] bg-white object-contain p-1" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-bg2 text-ink3">
                    <ShoppingBag className="size-6" aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink3">
                    {p.merchant} {p.source === "EXTENSION" && <Badge tone="violet">From extension</Badge>} {p.source === "DEMO" && <DemoBadge label="Demo" />}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="num font-display text-xl font-semibold">{money(p.latestPriceCents, p.currency)}</p>
                  <p className="text-[11px] text-ink3">{p.latestSeenAt ? `seen ${shortDate(p.latestSeenAt)}` : "no price yet"} · {p.observations.length} recorded</p>
                </div>
                <div className="w-24">
                  <Sparkline values={p.observations.map((o) => o.priceCents)} color="#39D9FF" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.verdict && <Badge tone={toneBadge[p.verdict.tone]}>{p.verdict.label}</Badge>}
                {p.targetPriceCents !== null && <Badge tone={p.latestPriceCents !== null && p.latestPriceCents <= p.targetPriceCents ? "pos" : "neutral"}>Target {money(p.targetPriceCents, p.currency, { noCents: true })}</Badge>}
                {p.status === "WATCHING" && <Badge tone="info">Watching</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}
      <Modal open={!!open} onClose={close} title={open?.title ?? ""} wide>
        {open && <ProductDetail p={open} budget={budget} onClose={close} />}
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a product">
        <AddProduct onDone={() => { setAdding(false); router.refresh(); }} />
      </Modal>
    </div>
  );
}
