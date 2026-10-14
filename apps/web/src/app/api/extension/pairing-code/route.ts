import { handler } from "@/server/http";
import { createPairingCode } from "@/server/services/extension";
import { audit } from "@/server/audit";

export const POST = handler({ rateLimit: { key: "pairing-code", limit: 10, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, ip, userAgent }) => {
  const code = await createPairingCode(auth.userId);
  await audit("extension.pairing_code_created", { userId: auth.userId, ip, userAgent });
  return code;
});
