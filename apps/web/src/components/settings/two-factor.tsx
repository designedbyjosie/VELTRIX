"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, ShieldCheck } from "lucide-react";
import { Badge, Button, Field, FormError, Input, Modal, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const toast = useToast();
  return (
    <div className="space-y-4 text-sm">
      <p className="text-ink2">Save these backup codes somewhere safe, like a password manager. Each works once if you lose your phone. They won&apos;t be shown again.</p>
      <ul className="panel-inner num grid grid-cols-2 gap-2 p-4 font-mono text-[15px] tracking-wider">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex justify-between gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(codes.join("\n"));
            toast("Backup codes copied");
          }}
        >
          <Copy className="size-3.5" /> Copy codes
        </Button>
        <Button variant="primary" size="sm" onClick={onDone}>
          I&apos;ve saved them
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorCard({ enabled, recoveryCodesRemaining }: { enabled: boolean; recoveryCodesRemaining: number }) {
  const router = useRouter();
  const toast = useToast();
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"disable" | "regenerate" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => setError(e instanceof ApiError ? (e.fields[0]?.message ?? e.message) : "Something went wrong.");

  return (
    <div className="mt-6 border-t border-line-soft pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-cyan" aria-hidden /> Two-factor sign-in {enabled ? <Badge tone="pos">On</Badge> : <Badge>Off</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-ink2">{enabled ? `Sign-in asks for a code from your authenticator app. ${recoveryCodesRemaining} backup codes left.` : "Add a code from an authenticator app (Google Authenticator, 1Password, Authy…) to every sign-in."}</p>
        </div>
        {enabled ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setError(null); setMode("regenerate"); }}>
              New backup codes
            </Button>
            <Button size="sm" variant="danger" onClick={() => { setError(null); setMode("disable"); }}>
              Turn off
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="primary"
            loading={busy && !setup}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                setSetup(await api("/api/settings/mfa", { body: {} }));
              } catch (e) {
                fail(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            Turn on
          </Button>
        )}
      </div>
      {!setup && !mode && <FormError message={error} />}

      <Modal open={!!setup && !codes} onClose={() => setSetup(null)} title="Set up two-factor sign-in">
        {setup && (
          <form
            className="space-y-4 text-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ recoveryCodes: string[] }>("/api/settings/mfa/enable", { body: { code: String(new FormData(e.currentTarget).get("code") ?? "") } });
                setCodes(r.recoveryCodes);
              } catch (err) {
                fail(err);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-ink2">1. Scan this QR code with your authenticator app.</p>
            {/* QR code SVG is generated server-side from our own otpauth URI (no user-controlled markup). */}
            {/* eslint-disable-next-line react/no-danger */}
            <div className="mx-auto w-48 rounded-[12px] bg-white p-2" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
            <p className="text-center text-xs text-ink3">
              Can&apos;t scan? Enter this key: <span className="num select-all font-mono text-ink">{setup.secret.match(/.{1,4}/g)?.join(" ")}</span>
            </p>
            <p className="text-ink2">2. Enter the 6-digit code the app shows.</p>
            <FormError message={error} />
            <Field label="Code" htmlFor="mfa-code">
              <Input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                Turn on
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!codes} onClose={() => undefined} title="Save your backup codes">
        {codes && (
          <RecoveryCodes
            codes={codes}
            onDone={() => {
              setCodes(null);
              setSetup(null);
              setMode(null);
              toast("Two-factor sign-in is on");
              router.refresh();
            }}
          />
        )}
      </Modal>

      <Modal open={mode !== null && !codes} onClose={() => setMode(null)} title={mode === "disable" ? "Turn off two-factor sign-in?" : "Create new backup codes"} description={mode === "disable" ? "Your account will be protected by your password only." : "Your old backup codes stop working."}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError(null);
            try {
              if (mode === "disable") {
                await api("/api/settings/mfa/disable", { body: { password: String(f.get("password")), code: String(f.get("code")) } });
                setMode(null);
                toast("Two-factor sign-in is off");
                router.refresh();
              } else {
                const r = await api<{ recoveryCodes: string[] }>("/api/settings/mfa/recovery-codes", { body: { password: String(f.get("password")) } });
                setCodes(r.recoveryCodes);
              }
            } catch (err) {
              fail(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormError message={error} />
          <Field label="Password" htmlFor="mfa-pw">
            <Input id="mfa-pw" name="password" type="password" autoComplete="current-password" required />
          </Field>
          {mode === "disable" && (
            <Field label="Authenticator or backup code" htmlFor="mfa-off-code">
              <Input id="mfa-off-code" name="code" autoComplete="one-time-code" required />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={mode === "disable" ? "danger" : "primary"} loading={busy}>
              {mode === "disable" ? "Turn off" : "Create codes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
