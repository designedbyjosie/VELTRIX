import { handler } from "@/server/http";
import { beginMfaSetup, mfaStatus } from "@/server/services/auth";

export const GET = handler({}, async ({ auth }) => mfaStatus(auth.userId));
/** Start setup: returns a new secret, otpauth URI and QR code. Not active until confirmed. */
export const POST = handler({ rateLimit: { key: "mfa-setup", limit: 10, windowMs: 60 * 60_000, by: "user" } }, async ({ auth }) => beginMfaSetup(auth.userId));
