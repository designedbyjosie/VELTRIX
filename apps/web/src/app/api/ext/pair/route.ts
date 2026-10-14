import { pairSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { redeemPairingCode } from "@/server/services/extension";
import { audit } from "@/server/audit";
import { HttpError } from "@/server/errors";

export const POST = handler({ auth: "none", body: pairSchema, rateLimit: { key: "pair", limit: 10, windowMs: 15 * 60_000 } }, async ({ body, ip, userAgent }) => {
  try {
    const r = await redeemPairingCode(body.code, body.deviceName);
    await audit("extension.paired", { userId: r.userId, ip, userAgent, metadata: { tokenId: r.tokenId } });
    return { token: r.token, expiresAt: r.expiresAt };
  } catch (err) {
    if (err instanceof HttpError) await audit("extension.pair_failed", { ip, userAgent });
    throw err;
  }
});
