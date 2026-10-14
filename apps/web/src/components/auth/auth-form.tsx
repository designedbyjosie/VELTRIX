"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

function MfaStep({ onDone, onRestart }: { onDone: () => void; onRestart: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [useBackup, setUseBackup] = useState(false);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/auth/login/mfa", { body: { code: String(new FormData(e.currentTarget).get("code") ?? "") } });
          onDone();
        } catch (err) {
          const ae = err instanceof ApiError ? err : new ApiError(0, "Couldn't reach VELTRIX.");
          if (ae.status === 401 && ae.message.includes("password again")) onRestart();
          setError(ae);
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="font-display text-xl font-semibold">Two-factor sign-in</h1>
        <p className="mt-1 text-sm text-ink2">{useBackup ? "Enter one of your saved backup codes." : "Enter the 6-digit code from your authenticator app."}</p>
      </div>
      {error && <FormError message={error.message} />}
      <Field label={useBackup ? "Backup code" : "Authentication code"} htmlFor="code">
        <Input id="code" name="code" autoFocus autoComplete="one-time-code" inputMode={useBackup ? "text" : "numeric"} placeholder={useBackup ? "XXXXX-XXXXX" : "123456"} required />
      </Field>
      <Button type="submit" variant="primary" className="w-full" loading={busy}>
        Verify
      </Button>
      <button type="button" className="w-full text-center text-sm text-cyan hover:underline" onClick={() => setUseBackup((b) => !b)}>
        {useBackup ? "Use your authenticator app instead" : "Lost your phone? Use a backup code"}
      </button>
    </form>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [mfa, setMfa] = useState(false);
  const next = params.get("next");
  const safeNext = next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
  const finish = () => {
    router.replace(safeNext);
    router.refresh();
  };

  if (mfa) return <MfaStep onDone={finish} onRestart={() => setMfa(false)} />;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await api("/api/auth/register", {
          body: {
            name: String(f.get("name") ?? ""),
            email: String(f.get("email") ?? ""),
            password: String(f.get("password") ?? ""),
            acceptTerms: f.get("acceptTerms") === "on",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
        router.replace("/verify-email");
        router.refresh();
        return;
      }
      const r = await api<{ mfaRequired: boolean }>("/api/auth/login", { body: { email: String(f.get("email") ?? ""), password: String(f.get("password") ?? "") } });
      if (r.mfaRequired) {
        setMfa(true);
        setBusy(false);
        return;
      }
      finish();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Couldn't reach VELTRIX. Check your connection."));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="font-display text-xl font-semibold">{mode === "login" ? "Sign in to VELTRIX" : "Create your VELTRIX account"}</h1>
        <p className="mt-1 text-sm text-ink2">{mode === "login" ? "Welcome back." : "Free to start. No bank passwords — ever."}</p>
      </div>
      {error && !error.fields.length && <FormError message={error.message} />}
      {mode === "register" && (
        <Field label="Name" htmlFor="name" error={error?.fieldError("name")}>
          <Input id="name" name="name" autoComplete="name" required aria-invalid={!!error?.fieldError("name")} />
        </Field>
      )}
      <Field label="Email" htmlFor="email" error={error?.fieldError("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!error?.fieldError("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={error?.fieldError("password")} hint={mode === "register" ? "At least 10 characters. Avoid common passwords." : undefined}>
        <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 10 : undefined} aria-invalid={!!error?.fieldError("password")} />
      </Field>
      {mode === "login" && (
        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="text-cyan hover:underline">
            Forgot password?
          </Link>
        </p>
      )}
      {mode === "register" && (
        <div>
          <label className="flex items-start gap-2 text-sm text-ink2">
            <input type="checkbox" name="acceptTerms" className="mt-1 accent-[#2878FF]" />
            <span>
              I agree to the <Link href="/legal/terms" className="text-cyan hover:underline">Terms</Link> and <Link href="/legal/privacy" className="text-cyan hover:underline">Privacy Policy</Link>, and understand VELTRIX provides information, not financial advice.
            </span>
          </label>
          {error?.fieldError("acceptTerms") && <p className="mt-1 text-xs text-neg">{error.fieldError("acceptTerms")}</p>}
        </div>
      )}
      <Button type="submit" variant="primary" className="w-full" loading={busy}>
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-ink2">
        {mode === "login" ? (
          <>
            New to VELTRIX? <Link href="/register" className="text-cyan hover:underline">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login" className="text-cyan hover:underline">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
