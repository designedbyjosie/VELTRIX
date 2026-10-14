import { deleteAccountSchema } from "@veltrix/shared";
import { handler, json } from "@/server/http";
import { db } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { HttpError } from "@/server/errors";
import { deleteUserAccount } from "@/server/services/settings";
import { clearSessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { env } from "@/server/env";

export const POST = handler({ body: deleteAccountSchema, rateLimit: { key: "delete-account", limit: 5, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body, ip, userAgent }) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: auth.userId } });
  if (!(await verifyPassword(body.password, user.passwordHash))) throw new HttpError(400, "invalid_password", "Your password is incorrect.");
  await deleteUserAccount(user.id);
  await audit("auth.account_deleted", { ip, userAgent, metadata: { deletedUserId: user.id } });
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie(env.isProduction) } });
});
