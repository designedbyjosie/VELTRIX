import { z } from "zod";
import { handler } from "@/server/http";
import { listRecurring, refreshRecurring } from "@/server/services/recurring";
import { userContext } from "@/server/services/users";

export const GET = handler({ query: z.object({ refresh: z.enum(["0", "1"]).optional() }) }, async ({ auth, query }) => {
  if (query.refresh === "1") await refreshRecurring(auth.userId, (await userContext(auth.userId)).timezone);
  return { items: await listRecurring(auth.userId) };
});
