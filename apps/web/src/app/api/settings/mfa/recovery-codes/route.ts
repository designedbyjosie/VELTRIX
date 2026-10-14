import { passwordConfirmSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { regenerateRecoveryCodes } from "@/server/services/auth";

export const POST = handler({ body: passwordConfirmSchema, rateLimit: { key: "mfa-recovery", limit: 5, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body }) => regenerateRecoveryCodes(auth.userId, body.password));
