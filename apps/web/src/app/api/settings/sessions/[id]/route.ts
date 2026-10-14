import { handler } from "@/server/http";
import { revokeSession } from "@/server/services/settings";
import { audit } from "@/server/audit";

export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params, ip, userAgent }) => {
  await revokeSession(auth.userId, params.id);
  await audit("session.revoked", { userId: auth.userId, ip, userAgent });
  return { ok: true };
});
