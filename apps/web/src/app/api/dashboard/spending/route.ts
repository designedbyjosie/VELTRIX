import { z } from "zod";
import { handler } from "@/server/http";
import { spendingOverview } from "@/server/services/dashboard";
import { userContext } from "@/server/services/users";

export const GET = handler({ query: z.object({ range: z.enum(["month", "3m", "12m"]).default("month") }) }, async ({ auth, query }) => {
  const ctx = await userContext(auth.userId);
  return spendingOverview(auth.userId, query.range, ctx.timezone, ctx.currency);
});
