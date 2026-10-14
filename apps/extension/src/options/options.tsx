import { useEffect, useState } from "react";
import { send, type Account, type Settings } from "../lib/messages";
import { Badge, Button, Mark } from "../lib/ui";

type Status = { connected: boolean; offline?: boolean; apiUrl: string; account?: Account | null };

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="strong block">{label}</span>
        <span className="muted small block">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Options() {
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [code, setCode] = useState("");
  const [site, setSite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [s, st] = await Promise.all([send<Status>({ type: "status" }), send<Settings>({ type: "settings:get" })]);
    if (s.ok) setStatus(s.data);
    if (st.ok) setSettings(st.data);
  };
  useEffect(() => {
    load();
  }, []);
  const update = async (patch: Partial<Settings>) => {
    const r = await send<Settings>({ type: "settings:set", settings: patch });
    if (r.ok) setSettings(r.data);
  };

  return (
    <div className="options">
      <header className="row gap-sm">
        <Mark size={28} />
        <span className="wordmark big">VELTRIX</span>
        <span className="muted small">Extension settings</span>
      </header>

      <section className="card stack">
        <h2>Account connection</h2>
        {status?.connected ? (
          <>
            <p>
              Connected as <span className="strong">{status.account?.displayName}</span> <span className="muted">({status.account?.email})</span> {status.offline && <Badge tone="warn">offline</Badge>}
            </p>
            <div>
              <Button
                onClick={async () => {
                  await send({ type: "disconnect" });
                  load();
                }}
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <form
            className="stack-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const r = await send({ type: "pair", code });
              setBusy(false);
              if (r.ok) {
                setCode("");
                load();
              } else setError(r.error);
            }}
          >
            <p className="muted small">In VELTRIX, go to Settings → Browser extension → Generate code. Codes expire after 10 minutes and work once.</p>
            <div className="row gap-sm">
              <label className="sr-only" htmlFor="code">
                Pairing code
              </label>
              <input id="code" className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" maxLength={9} autoComplete="off" />
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? "Connecting…" : "Connect"}
              </Button>
            </div>
            {error && <p className="error">{error}</p>}
          </form>
        )}
        <p className="muted tiny">Server: {status?.apiUrl}</p>
      </section>

      {settings && (
        <section className="card stack">
          <h2>Privacy</h2>
          <Toggle label="Analyze when I open the popup" hint="Off: nothing is read until you press “Analyze this page”. The extension never scans pages in the background." checked={settings.autoAnalyze} onChange={(v) => update({ autoAnalyze: v })} />
          <Toggle
            label="Share article text for AI summaries"
            hint={`Sends up to the first paragraphs of a news article you analyze. Also requires “Share article text” to be allowed in VELTRIX settings${status?.account ? (status.account.consents.pageContent ? " (allowed)." : " (currently not allowed)") : ""}.`}
            checked={settings.shareArticleText}
            onChange={(v) => update({ shareArticleText: v })}
          />
          <div className="stack-sm">
            <p className="strong">Sites where VELTRIX stays off</p>
            <form
              className="row gap-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const d = site.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
                if (d) update({ disabledSites: [...new Set([...settings.disabledSites, d])] });
                setSite("");
              }}
            >
              <label className="sr-only" htmlFor="site">
                Domain to disable
              </label>
              <input id="site" className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="example.com" />
              <Button type="submit">Add</Button>
            </form>
            <ul className="list">
              {settings.disabledSites.length === 0 && <li className="muted small">None.</li>}
              {settings.disabledSites.map((d) => (
                <li key={d} className="row between">
                  <span>{d}</span>
                  <button className="link" onClick={() => update({ disabledSites: settings.disabledSites.filter((x) => x !== d) })}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="card stack-sm">
        <h2>What the extension can access</h2>
        <ul className="bullets small">
          <li>Only the tab you open the popup on, and only at that moment (the browser&apos;s “activeTab” permission).</li>
          <li>Public page details: title, listed price and currency, merchant, product identifiers, article headline and date, ticker symbols.</li>
          <li>Never form fields, passwords, payment details or cookies. Checkout, login and banking pages are skipped entirely.</li>
          <li>Only the VELTRIX server it was built for ({status?.apiUrl}). It never purchases, trades or books anything.</li>
        </ul>
      </section>
    </div>
  );
}
