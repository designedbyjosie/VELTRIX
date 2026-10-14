import { z } from "zod";
import { passwordSchema } from "@veltrix/shared";
import { sendSecurityAlert } from "@/server/services/auth";
import { handler } from "@/server/http";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { HttpError } from "@/server/errors";
import { audit } from "@/server/audit";

const body = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema });
export const POST = handler({ body, rateLimit: { key: "password", limit: 5, windowMs: 15 * 60_000, by: "user" } }, async ({ auth, body, ip, userAgent }) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: auth.userId } });
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) throw new HttpError(400, "invalid_password", "Your current password is incorrect.");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  // Sign out every other session.
  await db.session.deleteMany({ where: { userId: user.id, NOT: { id: auth.sessionId } } });
  await audit("auth.password_changed", { userId: user.id, ip, userAgent });
  await sendSecurityAlert(user.id, "Your password was changed", "The password for your VELTRIX account was changed from Settings, and your other devices were signed out.");
  return { ok: true };
});
