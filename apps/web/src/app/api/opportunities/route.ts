import { z } from "zod";
import { handler } from "@/server/http";
import { opportunityOverview, refreshInsights } from "@/server/services/insights";
import { userContext } from "@/server/services/users";

export const GET = handler({ query: z.object({ refresh: z.enum(["0", "1"]).optional() }) }, async ({ auth, query }) => {
  if (query.refresh === "1") {
    const ctx = await userContext(auth.userId);
    await refreshInsights(auth.userId, ctx.timezone, ctx.currency);
  }
  return opportunityOverview(auth.userId);
});
