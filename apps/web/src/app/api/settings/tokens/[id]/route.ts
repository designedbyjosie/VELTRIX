import { handler } from "@/server/http";
import { revokeApiToken } from "@/server/services/settings";
import { audit } from "@/server/audit";

export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params, ip, userAgent }) => {
  await revokeApiToken(auth.userId, params.id);
  await audit("extension.token_revoked", { userId: auth.userId, ip, userAgent });
  return { ok: true };
});
