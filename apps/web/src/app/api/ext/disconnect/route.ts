import { handler } from "@/server/http";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

export const POST = handler({ auth: "session-or-token", scope: "extension" }, async ({ auth, ip, userAgent }) => {
  if (auth.kind === "token" && auth.tokenId) {
    await db.apiToken.update({ where: { id: auth.tokenId }, data: { revokedAt: new Date() } });
    await audit("extension.token_revoked", { userId: auth.userId, ip, userAgent });
  }
  return { ok: true };
});
