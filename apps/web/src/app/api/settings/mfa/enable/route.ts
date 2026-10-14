import { mfaCodeSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { enableMfa } from "@/server/services/auth";

export const POST = handler({ body: mfaCodeSchema, rateLimit: { key: "mfa-enable", limit: 10, windowMs: 15 * 60_000, by: "user" } }, async ({ auth, body }) => enableMfa(auth.userId, body.code));
