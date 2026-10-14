import { z } from "zod";
import { handler } from "@/server/http";
import { buildReport } from "@/server/services/reports";
import { userContext } from "@/server/services/users";

export const GET = handler({ query: z.object({ period: z.enum(["monthly", "yearly"]).default("monthly") }) }, async ({ auth, query }) => {
  const ctx = await userContext(auth.userId);
  return buildReport(auth.userId, query.period, ctx.timezone, ctx.currency);
});
