import { registerSchema } from "@veltrix/shared";
import { handler, json } from "@/server/http";
import { registerUser } from "@/server/services/users";
import { createSession, sessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { env } from "@/server/env";
import { z } from "zod";

const body = registerSchema.extend({ timezone: z.string().max(64).optional() });

export const POST = handler({ auth: "none", body, rateLimit: { key: "register", limit: 5, windowMs: 60 * 60_000 } }, async ({ body, ip, userAgent }) => {
  let timezone = body.timezone ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    timezone = "UTC";
  }
  const user = await registerUser({ name: body.name, email: body.email, password: body.password, timezone });
  const { token } = await createSession(user.id, userAgent);
  await audit("auth.register", { userId: user.id, ip, userAgent });
  return json({ ok: true }, { status: 201, headers: { "set-cookie": sessionCookie(token, env.isProduction) } });
});
