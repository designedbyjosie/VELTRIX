"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Copy, Download, KeyRound, MonitorSmartphone, Puzzle, ShieldCheck } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@veltrix/shared";
import { Badge, Button, Card, ConfirmButton, DemoBadge, Field, FormError, Input, Modal, Select, useToast } from "@/components/ui";
import { LoadDemoButton } from "@/components/dashboard/load-demo";
import { TwoFactorCard } from "./two-factor";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/format";

interface Props {
  profile: { displayName: string; email: string; baseCurrency: string; timezone: string; hasDemoData: boolean };
  preference: { notifyBudget: boolean; notifyPriceDrops: boolean; notifyGoals: boolean; extensionAutoAnalyze: boolean } | null;
  consents: Record<string, boolean>;
  sessions: { id: string; userAgent: string | null; lastSeenAt: string; createdAt: string; current: boolean }[];
  tokens: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; expiresAt: string }[];
  events: { id: string; type: string; createdAt: string; userAgent: string | null }[];
  integrations: { id: string; name: string; purpose: string; configured: boolean; mode: string; envVars: string[] }[];
  mfa: { enabled: boolean; recoveryCodesRemaining: number };
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-ink2">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-white/10 transition peer-checked:bg-blue peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-cyan" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

const EVENT_LABELS: Record<string, string> = {
  "auth.register": "Account created",
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.logout": "Signed out",
  "auth.password_changed": "Password changed",
  "auth.email_verified": "Email confirmed",
  "auth.password_reset_requested": "Password reset requested",
  "auth.password_reset": "Password reset by email link",
  "auth.account_locked": "Sign-in locked after failed attempts",
  "auth.mfa_enabled": "Two-factor sign-in turned on",
  "auth.mfa_disabled": "Two-factor sign-in turned off",
  "auth.mfa_recovery_regenerated": "New backup codes created",
  "auth.mfa_failed": "Incorrect two-factor code",
  "bank.connected": "Bank connected",
  "bank.removed": "Bank connection removed",
  "session.revoked": "Session revoked",
  "extension.pairing_code_created": "Extension pairing code created",
  "extension.paired": "Browser extension connected",
  "extension.token_revoked": "Browser extension disconnected",
  "data.exported": "Data exported",
  "data.demo_loaded": "Demo data loaded",
  "data.demo_removed": "Demo data removed",
  "data.csv_imported": "Transactions imported",
  "consent.changed": "Privacy choice changed",
  "security.rate_limited": "Too many requests blocked",
  "security.origin_rejected": "Cross-site request blocked",
};

function PairExtension() {
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const toast = useToast();
  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((new Date(code.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [code]);
  return (
    <div className="panel-inner p-4">
      {code && left > 0 ? (
        <div className="text-center">
          <p className="text-xs text-ink3">Enter this code in the extension&apos;s connect screen</p>
          <p className="num my-2 font-display text-3xl font-semibold tracking-[0.2em] text-cyan">{code.code}</p>
          <p className="text-xs text-ink3">
            Expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} · single use
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={async () => {
              await navigator.clipboard.writeText(code.code);
              toast("Code copied");
            }}
          >
            <Copy className="size-3.5" /> Copy
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink2">Generate a one-time code, then paste it into the VELTRIX extension. The extension receives its own revocable key — never your password.</p>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setCode(await api("/api/extension/pairing-code", { body: {} }));
              } finally {
                setBusy(false);
              }
            }}
          >
            <KeyRound className="size-4" /> Generate code
          </Button>
        </div>
      )}
    </div>
  );
}

export function SettingsView({ profile, preference, consents: initialConsents, sessions, tokens, events, integrations, mfa }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [consents, setConsents] = useState(initialConsents);
  const [prefs, setPrefs] = useState(preference ?? { notifyBudget: true, notifyPriceDrops: true, notifyGoals: true, extensionAutoAnalyze: true });
  const [profileError, setProfileError] = useState<ApiError | null>(null);
  const [pwError, setPwError] = useState<ApiError | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const setConsent = async (purpose: string, granted: boolean) => {
    setConsents((c) => ({ ...c, [purpose]: granted }));
    try {
      const r = await api<{ consents: Record<string, boolean> }>("/api/settings/consent", { body: { purpose, granted } });
      setConsents(r.consents);
      toast(granted ? "Permission granted" : "Permission withdrawn");
    } catch {
      setConsents((c) => ({ ...c, [purpose]: !granted }));
      toast("Couldn't save that choice.", "neg");
    }
  };
  const setPref = async (k: keyof typeof prefs, v: boolean) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    await api("/api/settings/preferences", { method: "PATCH", body: { [k]: v } }).catch(() => setPrefs((p) => ({ ...p, [k]: !v })));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Profile">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy("profile");
            setProfileError(null);
            try {
              await api("/api/settings/profile", { method: "PATCH", body: { displayName: String(f.get("displayName")), baseCurrency: String(f.get("baseCurrency")), timezone: String(f.get("timezone")) } });
              toast("Profile saved");
              router.refresh();
            } catch (err) {
              setProfileError(err as ApiError);
            } finally {
              setBusy(null);
            }
          }}
        >
          {profileError && <FormError message={profileError.message} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="s-name">
              <Input id="s-name" name="displayName" defaultValue={profile.displayName} required />
            </Field>
            <Field label="Email" htmlFor="s-email" hint="Email changes aren't supported yet.">
              <Input id="s-email" value={profile.email} disabled />
            </Field>
            <Field label="Base currency" htmlFor="s-cur" hint="Totals include only accounts in this currency.">
              <Select id="s-cur" name="baseCurrency" defaultValue={profile.baseCurrency}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time zone" htmlFor="s-tz">
              <Input id="s-tz" name="timezone" defaultValue={profile.timezone} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={busy === "profile"}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Notifications & extension">
        <div className="divide-y divide-line-soft">
          <Toggle label="Budget warnings" description="Notify when a category approaches its limit." checked={prefs.notifyBudget} onChange={(v) => setPref("notifyBudget", v)} />
          <Toggle label="Price drops" description="Notify when a saved product's observed price falls." checked={prefs.notifyPriceDrops} onChange={(v) => setPref("notifyPriceDrops", v)} />
          <Toggle label="Goal milestones" description="Notify about goal progress." checked={prefs.notifyGoals} onChange={(v) => setPref("notifyGoals", v)} />
          <Toggle label="Analyze when the extension opens" description="Opening the extension popup is the only trigger — pages are never scanned in the background." checked={prefs.extensionAutoAnalyze} onChange={(v) => setPref("extensionAutoAnalyze", v)} />
        </div>
      </Card>

      <Card id="privacy" title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-cyan" /> Privacy & consent</span>}>
        <p className="text-xs text-ink2">Optional processing is off until you turn it on. You can withdraw at any time; each change is recorded.</p>
        <div className="divide-y divide-line-soft">
          <Toggle
            label="AI processing"
            description="Send your question and the specific records needed to answer it to the configured AI provider. Off: answers use VELTRIX's built-in analysis only."
            checked={consents.AI_PROCESSING}
            onChange={(v) => setConsent("AI_PROCESSING", v)}
          />
          <Toggle
            label="Share article text from the extension"
            description="Allow the extension to send the first paragraphs of a news article you analyze so it can be summarized. Off: only the title and description are used."
            checked={consents.EXTENSION_PAGE_CONTENT}
            onChange={(v) => setConsent("EXTENSION_PAGE_CONTENT", v)}
          />
          <Toggle
            label="Record prices automatically"
            description="When you analyze a product you've already saved, record its current price to build history. Off: prices are only recorded when you save."
            checked={consents.PRICE_TRACKING}
            onChange={(v) => setConsent("PRICE_TRACKING", v)}
          />
        </div>
      </Card>

      <Card id="extension" title={<span className="flex items-center gap-2"><Puzzle className="size-4 text-cyan" /> Browser extension</span>}>
        <PairExtension />
        <p className="mt-3 text-xs font-medium text-ink3">Connected extensions</p>
        <ul className="mt-1 divide-y divide-line-soft">
          {tokens.length === 0 && <li className="py-2 text-sm text-ink2">None connected.</li>}
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
              <MonitorSmartphone className="size-4 text-ink3" aria-hidden />
              <span className="min-w-0 flex-1">
                {t.name}
                <span className="block text-xs text-ink3">
                  key {t.prefix}… · {t.lastUsedAt ? `used ${relativeTime(t.lastUsedAt)}` : "never used"} · expires {new Date(t.expiresAt).toLocaleDateString()}
                </span>
              </span>
              <ConfirmButton
                title={`Disconnect ${t.name}?`}
                body="The extension will need a new code to reconnect."
                confirmLabel="Disconnect"
                onConfirm={async () => {
                  await api(`/api/settings/tokens/${t.id}`, { method: "DELETE" });
                  toast("Extension disconnected");
                  router.refresh();
                }}
              >
                Disconnect
              </ConfirmButton>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-ink3">Install instructions: build the extension (<code>npm run build:extension</code>) and load <code>apps/extension/dist</code> as an unpacked extension in Chrome or Edge.</p>
      </Card>

      <Card id="security" title="Security">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            setBusy("pw");
            setPwError(null);
            try {
              await api("/api/settings/password", { body: { currentPassword: String(f.get("current")), newPassword: String(f.get("next")) } });
              toast("Password changed. Other sessions were signed out.");
              form.reset();
              router.refresh();
            } catch (err) {
              setPwError(err as ApiError);
            } finally {
              setBusy(null);
            }
          }}
        >
          <Field label="Current password" htmlFor="pw-cur">
            <Input id="pw-cur" name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={pwError?.fieldError("newPassword")}>
            <Input id="pw-new" name="next" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          <Button type="submit" loading={busy === "pw"}>
            Change password
          </Button>
        </form>
        {pwError && !pwError.fields.length && <FormError message={pwError.message} />}
        <TwoFactorCard enabled={mfa.enabled} recoveryCodesRemaining={mfa.recoveryCodesRemaining} />
        <p className="mt-5 text-xs font-medium text-ink3">Active sessions</p>
        <ul className="mt-1 divide-y divide-line-soft">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {s.userAgent?.slice(0, 70) ?? "Unknown device"}
                <span className="block text-xs text-ink3">active {relativeTime(s.lastSeenAt)}</span>
              </span>
              {s.current ? (
                <Badge tone="pos">This device</Badge>
              ) : (
                <ConfirmButton
                  title="Sign out this session?"
                  confirmLabel="Sign out"
                  onConfirm={async () => {
                    await api(`/api/settings/sessions/${s.id}`, { method: "DELETE" });
                    router.refresh();
                  }}
                >
                  Sign out
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-cyan">Recent security activity</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 text-ink2">
                <span>{EVENT_LABELS[e.type] ?? e.type}</span>
                <span className="text-ink3">{relativeTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card title="Integrations">
        <ul className="divide-y divide-line-soft">
          {integrations.map((i) => (
            <li key={i.id} className="py-2.5 text-sm">
              <p className="flex items-center gap-2 font-medium">
                {i.name} <Badge tone={i.configured ? "pos" : "neutral"}>{i.configured ? "Configured" : "Not configured"}</Badge>
              </p>
              <p className="text-xs text-ink2">{i.purpose}</p>
              <p className="text-[11px] text-ink3">
                {i.mode} · <code>{i.envVars.join(", ")}</code>
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card id="data" title="Your data" className="xl:col-span-2">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium">Export</p>
            <p className="mt-1 text-xs text-ink2">Download everything VELTRIX stores about you (JSON), or your transactions as CSV.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/api/settings/export?format=json" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-panel-hi px-3 text-[13px] font-medium hover:border-blue/60">
                <Download className="size-4" aria-hidden /> Full export (JSON)
              </a>
              <a href="/api/settings/export?format=csv" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-panel-hi px-3 text-[13px] font-medium hover:border-blue/60">
                <Download className="size-4" aria-hidden /> Transactions (CSV)
              </a>
            </div>
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              Demo data <DemoBadge />
            </p>
            <p className="mt-1 text-xs text-ink2">{profile.hasDemoData ? "Sample records are loaded and labeled throughout the app." : "Load a year of clearly labeled sample data to explore."}</p>
            <div className="mt-3">
              {profile.hasDemoData ? (
                <ConfirmButton
                  variant="secondary"
                  title="Remove all demo data?"
                  body="Only records tagged as demo are deleted. Your own records stay."
                  confirmLabel="Remove demo data"
                  onConfirm={async () => {
                    await api("/api/settings/demo", { method: "DELETE" });
                    toast("Demo data removed");
                    router.refresh();
                  }}
                >
                  Remove demo data
                </ConfirmButton>
              ) : (
                <LoadDemoButton />
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neg">Delete account</p>
            <p className="mt-1 text-xs text-ink2">Permanently deletes your account and all financial records. This can&apos;t be undone.</p>
            <Button className="mt-3" size="sm" variant="danger" onClick={() => setDeleting(true)}>
              Delete my account
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete your VELTRIX account?" description="All accounts, transactions, budgets, goals, saved items, AI conversations and extension connections are permanently deleted.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy("delete");
            setDeleteError(null);
            try {
              await api("/api/settings/delete-account", { body: { password: String(f.get("password")), confirm: String(f.get("confirm")) } });
              window.location.href = "/";
            } catch (err) {
              setDeleteError(err instanceof ApiError ? (err.fields[0]?.message ?? err.message) : "Couldn't delete the account.");
              setBusy(null);
            }
          }}
        >
          <FormError message={deleteError} />
          <Field label="Password" htmlFor="del-pw">
            <Input id="del-pw" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Field label='Type "DELETE" to confirm' htmlFor="del-confirm">
            <Input id="del-confirm" name="confirm" required autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy === "delete"}>
              Permanently delete
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
