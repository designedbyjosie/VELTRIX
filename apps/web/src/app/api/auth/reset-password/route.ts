import { resetPasswordSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { resetPassword } from "@/server/services/auth";

export const POST = handler({ auth: "none", body: resetPasswordSchema, rateLimit: { key: "reset-password", limit: 10, windowMs: 15 * 60_000 } }, async ({ body }) => {
  await resetPassword(body.token, body.password);
  return { ok: true };
});
