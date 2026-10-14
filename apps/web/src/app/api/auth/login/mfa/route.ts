import { mfaCodeSchema } from "@veltrix/shared";
import { handler, json } from "@/server/http";
import { completeMfaLogin } from "@/server/services/auth";
import { clearMfaCookie, MFA_COOKIE, readCookie, sessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { env } from "@/server/env";
import { HttpError } from "@/server/errors";

export const POST = handler({ auth: "none", body: mfaCodeSchema, rateLimit: { key: "login-mfa", limit: 20, windowMs: 15 * 60_000 } }, async ({ req, body, ip, userAgent }) => {
  const challenge = readCookie(req.headers.get("cookie"), MFA_COOKIE);
  if (!challenge) throw new HttpError(401, "challenge_expired", "Your sign-in timed out. Enter your password again.");
  try {
    const r = await completeMfaLogin(challenge, body.code, userAgent);
    await audit("auth.login", { userId: r.userId, ip, userAgent, metadata: { factor: r.factor } });
    const headers = new Headers();
    headers.append("set-cookie", sessionCookie(r.token, env.isProduction));
    headers.append("set-cookie", clearMfaCookie(env.isProduction));
    return json({ ok: true }, { headers });
  } catch (e) {
    await audit("auth.mfa_failed", { ip, userAgent });
    throw e;
  }
});
