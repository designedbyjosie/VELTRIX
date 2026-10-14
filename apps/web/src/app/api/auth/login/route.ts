import { loginSchema } from "@veltrix/shared";
import { handler, json } from "@/server/http";
import { loginWithPassword } from "@/server/services/auth";
import { mfaCookie, sessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { env } from "@/server/env";
import { rateLimit } from "@/server/rate-limit";
import { HttpError } from "@/server/errors";

export const POST = handler({ auth: "none", body: loginSchema, rateLimit: { key: "login-ip", limit: 20, windowMs: 15 * 60_000 } }, async ({ body, ip, userAgent }) => {
  // Per-account throttle slows targeted password guessing even across IPs.
  if (!(await rateLimit(`login-email:${body.email}`, 8, 15 * 60_000)).ok) {
    await audit("security.rate_limited", { ip, userAgent, metadata: { key: "login-email" } });
    throw new HttpError(429, "rate_limited", "Too many sign-in attempts for this account. Try again in 15 minutes.");
  }
  const outcome = await loginWithPassword(body.email, body.password, userAgent, ip);
  if (outcome.kind === "mfa") {
    return json({ ok: true, mfaRequired: true }, { headers: { "set-cookie": mfaCookie(outcome.challenge, env.isProduction) } });
  }
  await audit("auth.login", { userId: outcome.userId, ip, userAgent });
  return json({ ok: true, mfaRequired: false }, { headers: { "set-cookie": sessionCookie(outcome.token, env.isProduction) } });
});
