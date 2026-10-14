import { useCallback, useEffect, useState } from "react";
import type { ExtensionAnalysis, InsightLine, PageExtraction } from "@veltrix/shared";
import { send, type Account, type AnalyzeResult, type Settings } from "../lib/messages";
import { Badge, Button, Mark, money } from "../lib/ui";

type Status = { connected: boolean; offline?: boolean; apiUrl: string; account?: Account | null };

const TYPE_LABEL: Record<string, string> = { product: "Product page", article: "News article", instrument: "Market page", travel: "Travel page", unsupported: "No analysis" };
const PROVENANCE_LABEL: Record<string, string> = { user: "Your records", observed: "Prices you recorded", provider: "Market data", demo: "Demo data", estimate: "Estimate", education: "Tip", "verified-account": "Account data" };

/** Tab to analyze: the active tab, or an explicit ?tabId= (used by automated tests). */
function tabIdFromQuery(): number | undefined {
  const v = new URLSearchParams(location.search).get("tabId");
  return v && /^\d+$/.test(v) ? Number(v) : undefined;
}

function PairForm({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await send({ type: "pair", code });
        setBusy(false);
        if (r.ok) onPaired();
        else setError(r.error);
      }}
    >
      <p className="strong">Connect to your VELTRIX account</p>
      <p className="muted small">In VELTRIX, open Settings → Browser extension and generate a code.</p>
      <label className="sr-only" htmlFor="pair-code">
        Pairing code
      </label>
      <input id="pair-code" className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" maxLength={9} autoComplete="off" spellCheck={false} />
      {error && <p className="error">{error}</p>}
      <Button variant="primary" type="submit" disabled={busy || code.replace(/[^A-Z0-9]/g, "").length !== 8}>
        {busy ? "Connecting…" : "Connect"}
      </Button>
    </form>
  );
}

function Insights({ items }: { items: InsightLine[] }) {
  if (!items.length) return null;
  return (
    <ul className="insights">
      {items.map((i, n) => (
        <li key={n} className={`insight tone-${i.tone ?? "neutral"}`}>
          <span>{i.text}</span>
          <span className="prov">{PROVENANCE_LABEL[i.provenance] ?? i.provenance}</span>
        </li>
      ))}
    </ul>
  );
}

function SaveButton({ label, done, onSave }: { label: string; done: string; onSave: () => Promise<{ ok: boolean; error?: string }> }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button
        variant={state === "done" ? "secondary" : "primary"}
        disabled={state === "busy" || state === "done"}
        onClick={async () => {
          setState("busy");
          const r = await onSave();
          if (r.ok) setState("done");
          else {
            setState("error");
            setErr(r.error ?? "Couldn't save.");
          }
        }}
      >
        {state === "busy" ? "Saving…" : state === "done" ? done : label}
      </Button>
      {err && <p className="error">{err}</p>}
    </>
  );
}

function ProductView({ a, x }: { a: ExtensionAnalysis; x: PageExtraction }) {
  const p = a.product!;
  const [saved, setSaved] = useState<{ id: string; status: string; justNow: boolean } | null>(p.saved ? { ...p.saved, justNow: false } : null);
  const [busy, setBusy] = useState<"WISHLIST" | "WATCHING" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async (status: "WISHLIST" | "WATCHING") => {
    setBusy(status);
    setError(null);
    const r = await send<{ id: string; status: string }>({ type: "save", payload: { kind: "product", extraction: x, status } });
    setBusy(null);
    if (r.ok) setSaved({ id: r.data.id, status: r.data.status, justNow: true });
    else setError(r.error);
  };
  return (
    <div className="stack">
      <div className="card product">
        {p.imageUrl && p.imageUrl.startsWith("https://") ? <img src={p.imageUrl} alt="" referrerPolicy="no-referrer" /> : <div className="img-ph" aria-hidden />}
        <div className="min0">
          <p className="title clamp2">{p.title}</p>
          <p className="muted small">{p.merchant}</p>
          <p className="price">{money(p.priceCents, p.currency)}</p>
          {p.verdict && (
            <Badge tone={p.verdict.tone === "positive" ? "pos" : p.verdict.tone === "warning" ? "warn" : "neutral"} title={p.verdict.basis}>
              {p.verdict.label}
            </Badge>
          )}
        </div>
      </div>
      {p.historyStats && (
        <p className="muted small">
          {p.historyStats.count} recorded · low {money(p.historyStats.lowCents, p.currency)} · avg {money(p.historyStats.avgCents, p.currency)}
        </p>
      )}
      <Insights items={saved?.justNow ? a.insights.filter((i) => !i.text.startsWith("Save this product")) : a.insights} />
      {saved ? (
        <>
          <p className="notice ok center" role="status">
            {saved.justNow ? "Saved to " : "On "}your {saved.status === "WATCHING" ? "watch list" : "wishlist"} ✓
          </p>
          <Button variant="primary" onClick={() => send({ type: "open", path: `/app/shopping?product=${saved.id}` })}>
            View price history
          </Button>
        </>
      ) : (
        <>
          <div className="row">
            <Button variant="primary" disabled={!!busy} onClick={() => save("WISHLIST")}>
              {busy === "WISHLIST" ? "Saving…" : "Save to wishlist"}
            </Button>
            <Button disabled={!!busy} onClick={() => save("WATCHING")}>
              {busy === "WATCHING" ? "Saving…" : "Watch price"}
            </Button>
          </div>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </div>
  );
}

function InstrumentsView({ a, x }: { a: ExtensionAnalysis; x: PageExtraction }) {
  return (
    <div className="stack">
      {a.article && (
        <div className="card stack-sm">
          <p className="title">{a.article.headline}</p>
          <p className="muted small">
            {a.article.publisher ?? "Unknown publisher"}
            {a.article.publishedAt ? ` · ${new Date(a.article.publishedAt).toLocaleDateString()}` : ""}
          </p>
          {a.article.summary && (
            <p className="small">
              {a.article.summary} <span className="prov">{a.article.summarySource === "ai" ? "AI summary" : "Publisher description"}</span>
            </p>
          )}
        </div>
      )}
      {a.instruments && a.instruments.length > 0 && (
        <div className="card">
          <p className="label">Mentioned instruments</p>
          <ul className="list">
            {a.instruments.map((i) => (
              <li key={i.symbol} className="row between">
                <span className="min0">
                  <span className="strong">{i.symbol}</span> <span className="muted small">{i.name ?? "not in data source"}</span>
                  {i.priceCents !== null && (
                    <span className="small block">
                      {money(i.priceCents, i.currency)}{" "}
                      {i.changePercent !== null && <span className={i.changePercent >= 0 ? "pos" : "neg"}>{i.changePercent > 0 ? "+" : ""}{i.changePercent.toFixed(2)}%</span>} {i.isDemo && <Badge tone="demo">demo</Badge>}
                    </span>
                  )}
                </span>
                {i.onWatchlist ? (
                  <Badge tone="pos">Watching</Badge>
                ) : (
                  <SaveButton label="Watch" done="Added ✓" onSave={async () => { const r = await send({ type: "save", payload: { kind: "watchlist", symbol: i.symbol } }); return r.ok ? { ok: true } : { ok: false, error: r.error }; }} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Insights items={a.insights} />
      {a.article && !a.article.saved && (
        <SaveButton label="Save article to VELTRIX" done="Saved to research ✓" onSave={async () => { const r = await send({ type: "save", payload: { kind: "article", extraction: x } }); return r.ok ? { ok: true } : { ok: false, error: r.error }; }} />
      )}
      {a.article?.saved && <p className="muted small center">Article saved to your research</p>}
    </div>
  );
}

function TravelView({ a, x }: { a: ExtensionAnalysis; x: PageExtraction }) {
  const t = a.travel!;
  const [tripId, setTripId] = useState(t.trips[0]?.id ?? "");
  return (
    <div className="stack">
      <div className="card stack-sm">
        <p className="title">{a.headline}</p>
        <p className="muted small">
          {t.kind} · {t.provider}
        </p>
        <p className="price">{t.priceCents ? money(t.priceCents, t.currency) : "No price found"}</p>
      </div>
      <Insights items={a.insights} />
      {t.trips.length > 0 && t.priceCents ? (
        <div className="card stack-sm">
          <label className="label" htmlFor="trip">
            Save this price as a quote on
          </label>
          <select id="trip" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
            {t.trips.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
          <SaveButton label="Add quote to trip" done="Added to trip ✓" onSave={async () => { const r = await send({ type: "save", payload: { kind: "travel", extraction: x, tripId } }); return r.ok ? { ok: true } : { ok: false, error: r.error }; }} />
        </div>
      ) : null}
    </div>
  );
}

function LocalSummary({ x }: { x: PageExtraction }) {
  if (x.pageType === "unsupported") return null;
  return (
    <div className="card stack-sm">
      <p className="label">Detected on this page</p>
      {x.product && (
        <>
          <p className="title clamp2">{x.product.title}</p>
          <p className="price">{money(x.product.priceCents, x.product.currency)}</p>
        </>
      )}
      {x.article && <p className="title">{x.article.headline}</p>}
      {x.symbols.length > 0 && <p className="small">Tickers: {x.symbols.join(", ")}</p>}
      {x.travel && <p className="small">{x.travel.kind} on {x.travel.provider}</p>}
      <p className="muted small">Analyzed locally. Nothing was sent to VELTRIX.</p>
    </div>
  );
}

export function Popup() {
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const run = useCallback(async () => {
    setAnalyzing(true);
    const r = await send<AnalyzeResult>({ type: "analyze", tabId: tabIdFromQuery() });
    setResult(r.ok ? r.data : { state: "error", message: r.error, extraction: null });
    setAnalyzing(false);
  }, []);

  const init = useCallback(async () => {
    const [s, st] = await Promise.all([send<Status>({ type: "status" }), send<Settings>({ type: "settings:get" })]);
    setStatus(s.ok ? s.data : { connected: false, apiUrl: "" });
    const cfg = st.ok ? st.data : null;
    setSettings(cfg);
    if (cfg?.autoAnalyze !== false) run();
  }, [run]);

  useEffect(() => {
    init();
  }, [init]);

  const a = result?.state === "ok" ? result.analysis : null;
  const pageType = a?.pageType ?? (result && "extraction" in result && result.extraction ? result.extraction.pageType : null);

  return (
    <div className="popup">
      <header className="row between">
        <span className="row gap-sm">
          <Mark />
          <span className="wordmark">VELTRIX</span>
        </span>
        <span className="row gap-sm">
          {pageType && <Badge tone="info">{TYPE_LABEL[pageType]}</Badge>}
          <button className="icon-btn" onClick={() => chrome.runtime.openOptionsPage()} aria-label="Extension settings" title="Settings">
            ⚙
          </button>
        </span>
      </header>

      <main className="stack">
        {status?.offline && <p className="notice warn">VELTRIX can&apos;t be reached right now. Showing what was detected locally.</p>}
        {(analyzing || (!result && settings?.autoAnalyze !== false)) && (
          <div className="card center stack-sm" aria-live="polite">
            <div className="spinner" aria-hidden />
            <p className="muted small">Analyzing this page…</p>
          </div>
        )}
        {!analyzing && !result && settings?.autoAnalyze === false && (
          <div className="card stack-sm center">
            <p className="small muted">Automatic analysis is off.</p>
            <Button variant="primary" onClick={run}>
              Analyze this page
            </Button>
          </div>
        )}
        {!analyzing && result?.state === "unsupported" && (
          <div className="card stack-sm">
            <p className="strong">{result.reason === "disabled-site" ? "VELTRIX is turned off for this site" : result.reason === "no-access" ? "This page can't be analyzed" : "Nothing to analyze here"}</p>
            <p className="muted small">
              {result.reason === "disabled-site" ? "You can re-enable it in the extension settings." : result.reason === "no-access" ? "The browser doesn't allow extensions on this page." : "Open a product, financial article, stock quote or travel page."}
            </p>
          </div>
        )}
        {!analyzing && result?.state === "local-only" && (
          <>
            <LocalSummary x={result.extraction} />
            <PairForm onPaired={() => { init(); }} />
          </>
        )}
        {!analyzing && result?.state === "offline" && (
          <>
            {result.extraction && <LocalSummary x={result.extraction} />}
            <div className="card stack-sm">
              <p className="strong">You&apos;re offline or VELTRIX is unavailable</p>
              <Button onClick={run}>Try again</Button>
            </div>
          </>
        )}
        {!analyzing && result?.state === "error" && (
          <div className="card stack-sm">
            <p className="strong">Analysis didn&apos;t complete</p>
            <p className="muted small">{result.message}</p>
            <Button onClick={run}>Try again</Button>
          </div>
        )}
        {!analyzing && a && a.pageType === "unsupported" && (
          <div className="card stack-sm">
            <p className="strong">{a.headline}</p>
            <p className="muted small">VELTRIX works on product pages, financial news, stock quote pages and travel bookings.</p>
          </div>
        )}
        {!analyzing && a && result?.state === "ok" && a.pageType === "product" && <ProductView a={a} x={result.extraction} />}
        {!analyzing && a && result?.state === "ok" && (a.pageType === "article" || a.pageType === "instrument") && <InstrumentsView a={a} x={result.extraction} />}
        {!analyzing && a && result?.state === "ok" && a.pageType === "travel" && <TravelView a={a} x={result.extraction} />}
      </main>

      <footer className="stack-sm">
        {a?.disclaimers.map((d) => (
          <p key={d} className="muted tiny">
            {d}
          </p>
        ))}
        <div className="row between">
          {status?.connected && status.account ? <span className="muted tiny">Signed in as {status.account.displayName}</span> : <span className="muted tiny">Not connected</span>}
          <button className="link" onClick={() => send({ type: "open", path: "/app" })}>
            Open dashboard
          </button>
        </div>
      </footer>
    </div>
  );
}
