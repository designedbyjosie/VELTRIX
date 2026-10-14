import { handler } from "@/server/http";
import { loadDemoData, removeDemoData } from "@/server/services/demo";
import { userContext } from "@/server/services/users";

export const POST = handler({ rateLimit: { key: "demo", limit: 10, windowMs: 60 * 60_000, by: "user" } }, async ({ auth }) => loadDemoData(auth.userId, (await userContext(auth.userId)).timezone));
export const DELETE = handler({}, async ({ auth }) => {
  await removeDemoData(auth.userId);
  return { ok: true };
});
