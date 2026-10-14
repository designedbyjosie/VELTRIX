import { forgotPasswordSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { requestPasswordReset } from "@/server/services/auth";
import { rateLimit } from "@/server/rate-limit";

export const POST = handler({ auth: "none", body: forgotPasswordSchema, rateLimit: { key: "forgot-ip", limit: 10, windowMs: 15 * 60_000 } }, async ({ body }) => {
  // At most 3 emails per address per hour; the response never reveals whether the account exists.
  if ((await rateLimit(`forgot-email:${body.email}`, 3, 60 * 60_000)).ok) {
    await requestPasswordReset(body.email).catch((e) => console.error("[veltrix] reset email failed", e));
  }
  return { ok: true };
});
