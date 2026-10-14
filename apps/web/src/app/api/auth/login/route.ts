import { loginSchema } from "@veltrix/shared";
import { handler, json } from "@/server/http";
import { authenticateUser } from "@/server/services/users";
import { createSession, sessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { env } from "@/server/env";
import { rateLimit } from "@/server/rate-limit";
import { HttpError } from "@/server/errors";

export const POST = handler({ auth: "none", body: loginSchema, rateLimit: { key: "login-ip", limit: 20, windowMs: 15 * 60_000 } }, async ({ body, ip, userAgent }) => {
  // Per-account throttle slows targeted password guessing even across IPs.
  if (!rateLimit(`login-email:${body.email}`, 8, 15 * 60_000).ok) {
    await audit("security.rate_limited", { ip, userAgent, metadata: { key: "login-email" } });
    throw new HttpError(429, "rate_limited", "Too many sign-in attempts for this account. Try again in 15 minutes.");
  }
  const user = await authenticateUser(body.email, body.password);
  if (!user) {
    await audit("auth.login_failed", { ip, userAgent });
    throw new HttpError(401, "invalid_credentials", "That email and password combination didn't match.");
  }
  const { token } = await createSession(user.id, userAgent);
  await audit("auth.login", { userId: user.id, ip, userAgent });
  return json({ ok: true }, { headers: { "set-cookie": sessionCookie(token, env.isProduction) } });
});
