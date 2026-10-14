"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Newspaper, Plus, Search, Star } from "lucide-react";
import { Badge, Button, Card, ConfirmButton, DemoBadge, EmptyState, Field, FormError, Input, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { relativeTime, shortDate } from "@/lib/format";

interface Quote {
  price: number;
  currency: string;
  changePercent: number | null;
  asOf: string;
  isDemo: boolean;
}
export interface WatchItem {
  id: string;
  symbol: string;
  name: string;
  type: string;
  verified: boolean;
  source: string;
  addedAt: string;
  quote: Quote | null;
}
export interface AlertView {
  id: string;
  symbol: string;
  condition: "ABOVE" | "BELOW";
  targetPrice: number;
  status: string;
  triggeredAt: string | null;
  lastCheckedAt: string | null;
}
export interface ArticleView {
  id: string;
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
  summary: string | null;
  summarySource: string;
  symbols: string[];
  source: string;
  savedAt: string;
}
interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export function InstrumentSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await api<{ results: SearchResult[]; dataSource: { label: string } }>(`/api/markets/search?q=${encodeURIComponent(q)}`);
        setResults(r.results);
        setLabel(r.dataSource.label);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Card title="Find a stock or ETF">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink3" aria-hidden />
        <Input aria-label="Search by ticker or company" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ticker or company, e.g. VOO or Apple" />
      </div>
      <ul className="mt-3 divide-y divide-line-soft">
        {results.slice(0, 8).map((r) => (
          <li key={r.symbol}>
            <Link href={`/app/markets/${encodeURIComponent(r.symbol)}`} className="flex items-center gap-3 py-2 text-sm hover:text-cyan">
              <span className="w-14 font-semibold">{r.symbol}</span>
              <span className="truncate text-ink2">{r.name}</span>
              <Badge className="ml-auto">{r.type}</Badge>
            </Link>
          </li>
        ))}
        {q && results.length === 0 && <li className="py-3 text-sm text-ink2">No instruments match “{q}” in the configured data source.</li>}
      </ul>
      {label && <p className="mt-2 text-[11px] text-ink3">Source: {label}</p>}
    </Card>
  );
}

export function WatchlistCard({ items }: { items: WatchItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Watchlist" action={<Star className="size-4 text-ink3" aria-hidden />}>
      <form
        className="mb-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const symbol = String(new FormData(form).get("symbol") ?? "").trim();
          if (!symbol) return;
          setBusy(true);
          setError(null);
          try {
            await api("/api/watchlist", { body: { symbol } });
            form.reset();
            toast(`${symbol.toUpperCase()} added to watchlist`);
            router.refresh();
          } catch (err) {
            setError(err instanceof ApiError ? err.fieldError("symbol") ?? err.message : "Couldn't add that symbol.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input name="symbol" aria-label="Ticker to add" placeholder="Add ticker" className="uppercase" />
        <Button type="submit" loading={busy}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
      <FormError message={error} />
      {items.length === 0 ? (
        <EmptyState icon={<Star className="size-5" />} title="Nothing on your watchlist" body="Add tickers here, or from any financial page using the VELTRIX extension." />
      ) : (
        <ul className="divide-y divide-line-soft">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/app/markets/${i.symbol}`} className="font-semibold hover:text-cyan">
                  {i.symbol}
                </Link>
                <p className="truncate text-xs text-ink3">
                  {i.name} {i.source === "EXTENSION" && "· saved from extension"} {!i.verified && "· not found in data source"}
                </p>
              </div>
              {i.quote ? (
                <div className="text-right">
                  <p className="num text-sm">{i.quote.price.toFixed(2)}</p>
                  <p className={`num text-xs ${(i.quote.changePercent ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>
                    {i.quote.changePercent !== null ? `${i.quote.changePercent > 0 ? "+" : ""}${i.quote.changePercent.toFixed(2)}%` : "—"}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-ink3">no quote</span>
              )}
              <ConfirmButton
                title={`Remove ${i.symbol} from your watchlist?`}
                confirmLabel="Remove"
                ariaLabel={`Remove ${i.symbol}`}
                onConfirm={async () => {
                  await api(`/api/watchlist/${i.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                ×
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
      {items.some((i) => i.quote?.isDemo) && (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-ink3">
          <DemoBadge label="Demo prices" /> Simulated quotes, delayed by design.
        </p>
      )}
    </Card>
  );
}

export function AlertsCard({ alerts, defaultSymbol }: { alerts: AlertView[]; defaultSymbol?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Price alerts" action={<Bell className="size-4 text-ink3" aria-hidden />}>
      <form
        className="grid grid-cols-[1fr_110px_1fr_auto] items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          setBusy(true);
          setError(null);
          try {
            await api("/api/alerts", { body: { symbol: String(f.get("symbol")), condition: String(f.get("condition")), targetPrice: String(f.get("targetPrice")).replace(/[$,]/g, "") } });
            toast("Alert created");
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err as ApiError);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Symbol" htmlFor="al-sym">
          <Input id="al-sym" name="symbol" defaultValue={defaultSymbol} required className="uppercase" />
        </Field>
        <Field label="When price is" htmlFor="al-cond">
          <Select id="al-cond" name="condition">
            <option value="BELOW">Below</option>
            <option value="ABOVE">Above</option>
          </Select>
        </Field>
        <Field label="Target" htmlFor="al-target">
          <Input id="al-target" name="targetPrice" inputMode="decimal" required placeholder="100.00" />
        </Field>
        <Button type="submit" loading={busy}>
          Add
        </Button>
      </form>
      {error && <FormError message={error.fields.length ? error.fields.map((f) => f.message).join(" ") : error.message} />}
      <ul className="mt-3 divide-y divide-line-soft">
        {alerts.length === 0 && <li className="py-3 text-sm text-ink2">No alerts. You&apos;ll get a notification when a target is crossed.</li>}
        {alerts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="font-semibold">{a.symbol}</span>
            <span className="text-ink2">
              {a.condition === "ABOVE" ? "above" : "below"} <span className="num text-ink">{a.targetPrice.toFixed(2)}</span>
            </span>
            {a.status === "TRIGGERED" ? <Badge tone="pos">Triggered {a.triggeredAt ? relativeTime(a.triggeredAt) : ""}</Badge> : <Badge>{a.lastCheckedAt ? `checked ${relativeTime(a.lastCheckedAt)}` : "Active"}</Badge>}
            <span className="ml-auto">
              <ConfirmButton
                title="Delete this alert?"
                ariaLabel={`Delete ${a.symbol} alert`}
                onConfirm={async () => {
                  await api(`/api/alerts/${a.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                Delete
              </ConfirmButton>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink3">Alerts are checked when you open VELTRIX and by the scheduled job. They notify you; they never place trades.</p>
    </Card>
  );
}

export function ArticlesCard({ articles }: { articles: ArticleView[] }) {
  const router = useRouter();
  return (
    <Card id="articles" title="Saved research" action={<Newspaper className="size-4 text-ink3" aria-hidden />}>
      {articles.length === 0 ? (
        <EmptyState icon={<Newspaper className="size-5" />} title="No saved articles" body="Use the browser extension on a financial news page to save it here with the tickers it mentions. A news feed provider isn't configured." />
      ) : (
        <ul className="space-y-3">
          {articles.map((a) => (
            <li key={a.id} className="panel-inner p-3">
              <div className="flex items-start gap-2">
                <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink hover:text-cyan">
                  {a.title}
                </a>
                {a.source === "DEMO" && <DemoBadge />}
              </div>
              <p className="mt-0.5 text-xs text-ink3">
                {a.publisher ?? "Unknown publisher"}
                {a.publishedAt ? ` · ${shortDate(a.publishedAt, { month: "short", day: "numeric", year: "numeric" })}` : ""} · saved {relativeTime(a.savedAt)}
              </p>
              {a.summary && (
                <p className="mt-2 text-sm text-ink2">
                  {a.summary} <span className="text-[11px] text-ink3">({a.summarySource === "ai" ? "AI summary" : "publisher description"})</span>
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {a.symbols.map((s) => (
                  <Link key={s} href={`/app/markets/${s}`}>
                    <Badge tone="info">{s}</Badge>
                  </Link>
                ))}
                <span className="ml-auto">
                  <ConfirmButton
                    title="Remove this article?"
                    confirmLabel="Remove"
                    onConfirm={async () => {
                      await api(`/api/articles/${a.id}`, { method: "DELETE" });
                      router.refresh();
                    }}
                  >
                    Remove
                  </ConfirmButton>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
