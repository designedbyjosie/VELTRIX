"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MailCheck } from "lucide-react";
import { Button, Field, FormError, Input, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

export function VerifyEmail({ token, email, signedIn }: { token: string | null; email: string | null; signedIn: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "verifying" | "done" | "error">(token ? "verifying" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api("/api/auth/verify-email", { body: { token } })
      .then(() => setState("done"))
      .catch((e) => {
        setState("error");
        setError(e instanceof ApiError ? e.message : "That link didn't work.");
      });
  }, [token]);

  if (state === "verifying")
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Spinner />
        <p className="text-sm text-ink2">Confirming your email…</p>
      </div>
    );
  if (state === "done")
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-10 text-pos" aria-hidden />
        <h1 className="font-display text-xl font-semibold">Email confirmed</h1>
        <p className="text-sm text-ink2">Your account is ready.</p>
        <Button variant="primary" className="w-full" onClick={() => { router.replace(signedIn ? "/app" : "/login"); router.refresh(); }}>
          {signedIn ? "Open VELTRIX" : "Sign in"}
        </Button>
      </div>
    );
  return (
    <div className="space-y-4">
      <MailCheck className="size-10 text-cyan" aria-hidden />
      <h1 className="font-display text-xl font-semibold">Confirm your email</h1>
      {error && <FormError message={error} />}
      <p className="text-sm text-ink2">
        We sent a confirmation link{email ? <> to <span className="text-ink">{email}</span></> : ""}. Open it to finish setting up your account. Check your spam folder if it isn&apos;t there in a minute.
      </p>
      {signedIn ? (
        <>
          <Button
            className="w-full"
            loading={busy}
            disabled={sent}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ alreadyVerified: boolean }>("/api/auth/resend-verification", { body: {} });
                if (r.alreadyVerified) {
                  router.replace("/app");
                  router.refresh();
                } else setSent(true);
              } catch (e) {
                setError(e instanceof ApiError ? e.message : "Couldn't send the email.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {sent ? "Sent — check your inbox" : "Send a new link"}
          </Button>
          <button
            className="w-full text-center text-sm text-ink3 hover:text-ink"
            onClick={async () => {
              await api("/api/auth/logout", { body: {} }).catch(() => undefined);
              window.location.href = "/login";
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <Link href="/login" className="block text-center text-sm text-cyan hover:underline">
          Sign in to request a new link
        </Link>
      )}
    </div>
  );
}

export function ForgotPassword() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  if (done)
    return (
      <div className="space-y-3">
        <h1 className="font-display text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-ink2">If an account exists for that address, a reset link is on its way. It expires in 1 hour.</p>
        <Link href="/login" className="block text-sm text-cyan hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/auth/forgot-password", { body: { email: String(new FormData(e.currentTarget).get("email") ?? "") } });
          setDone(true);
        } catch (err) {
          setError(err instanceof ApiError ? err : new ApiError(0, "Couldn't reach VELTRIX."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="font-display text-xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-ink2">Enter your account email and we&apos;ll send a reset link.</p>
      </div>
      {error && !error.fields.length && <FormError message={error.message} />}
      <Field label="Email" htmlFor="email" error={error?.fieldError("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" variant="primary" className="w-full" loading={busy}>
        Send reset link
      </Button>
      <Link href="/login" className="block text-center text-sm text-ink2 hover:text-ink">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPassword({ token }: { token: string | null }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  if (!token)
    return (
      <div className="space-y-3">
        <h1 className="font-display text-xl font-semibold">Reset link missing</h1>
        <p className="text-sm text-ink2">Open the link from your email, or request a new one.</p>
        <Link href="/forgot-password" className="text-sm text-cyan hover:underline">
          Request a reset link
        </Link>
      </div>
    );
  if (done)
    return (
      <div className="space-y-3">
        <h1 className="font-display text-xl font-semibold">Password changed</h1>
        <p className="text-sm text-ink2">You&apos;ve been signed out everywhere. Sign in with your new password.</p>
        <Link href="/login" className="brand-gradient inline-flex h-10 w-full items-center justify-center rounded-[10px] text-sm font-medium text-white">
          Sign in
        </Link>
      </div>
    );
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("password") !== f.get("confirm")) {
          setError(new ApiError(422, "", [{ path: "confirm", message: "Passwords don't match" }]));
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await api("/api/auth/reset-password", { body: { token, password: String(f.get("password")) } });
          setDone(true);
        } catch (err) {
          setError(err instanceof ApiError ? err : new ApiError(0, "Couldn't reach VELTRIX."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="font-display text-xl font-semibold">Choose a new password</h1>
      {error && !error.fields.length && <FormError message={error.message} />}
      <Field label="New password" htmlFor="password" error={error?.fieldError("password")} hint="At least 10 characters. Avoid common passwords.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={error?.fieldError("confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="primary" className="w-full" loading={busy}>
        Save new password
      </Button>
    </form>
  );
}
