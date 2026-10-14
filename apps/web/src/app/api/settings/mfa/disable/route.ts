import { mfaDisableSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { disableMfa } from "@/server/services/auth";

export const POST = handler({ body: mfaDisableSchema, rateLimit: { key: "mfa-disable", limit: 10, windowMs: 15 * 60_000, by: "user" } }, async ({ auth, body }) => {
  await disableMfa(auth.userId, body.password, body.code);
  return { ok: true };
});
