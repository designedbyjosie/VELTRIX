import { handler } from "@/server/http";
import { removeDemoData } from "@/server/services/demo";

/** Removes legacy demo records (tagged DEMO) from accounts created when demo data existed. */
export const DELETE = handler({}, async ({ auth }) => {
  await removeDemoData(auth.userId);
  return { ok: true };
});
