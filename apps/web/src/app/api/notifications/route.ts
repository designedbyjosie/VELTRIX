import { z } from "zod";
import { handler } from "@/server/http";
import { listNotifications, markRead } from "@/server/services/notifications";

export const GET = handler({}, async ({ auth }) => listNotifications(auth.userId));
export const POST = handler({ body: z.object({ id: z.string().min(1).max(64) }) }, async ({ auth, body }) => {
  await markRead(auth.userId, body.id === "all" ? "all" : body.id);
  return { ok: true };
});
