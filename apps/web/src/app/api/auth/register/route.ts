import { registerSchema } from "@veltrix/shared";
import { handler, json } from "@/server/http";
import { registerUser } from "@/server/services/users";
import { sendVerificationEmail } from "@/server/services/auth";
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
  let emailSent = true;
  try {
    await sendVerificationEmail(user.id);
  } catch (e) {
    // The account exists either way; the user can request another email from the verify page.
    console.error("[veltrix] verification email failed", e);
    emailSent = false;
  }
  const { token } = await createSession(user.id, userAgent);
  await audit("auth.register", { userId: user.id, ip, userAgent });
  return json({ ok: true, verificationRequired: env.requireEmailVerification, emailSent }, { status: 201, headers: { "set-cookie": sessionCookie(token, env.isProduction) } });
});
