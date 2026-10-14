import { verifyEmailSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { verifyEmail } from "@/server/services/auth";

export const POST = handler({ auth: "none", body: verifyEmailSchema, rateLimit: { key: "verify-email", limit: 30, windowMs: 15 * 60_000 } }, async ({ body }) => {
  await verifyEmail(body.token);
  return { ok: true };
});
