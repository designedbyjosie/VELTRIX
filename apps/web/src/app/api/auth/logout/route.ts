import { handler, json } from "@/server/http";
import { clearSessionCookie, destroySession, readCookie, SESSION_COOKIE } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { env } from "@/server/env";

export const POST = handler({ auth: "session", allowUnverified: true }, async ({ req, auth, ip, userAgent }) => {
  await destroySession(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  await audit("auth.logout", { userId: auth.userId, ip, userAgent });
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie(env.isProduction) } });
});
