import { z } from "zod";
import { budgetCreateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { budgetStatusForMonth, createBudget } from "@/server/services/budgets";
import { userContext } from "@/server/services/users";
import { todayIn } from "@/server/dates";

export const GET = handler({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }) }, async ({ auth, query }) => {
  const ctx = await userContext(auth.userId);
  const month = query.month ?? todayIn(ctx.timezone).slice(0, 7);
  return { month, budgets: await budgetStatusForMonth(auth.userId, month, ctx.timezone) };
});
export const POST = handler({ body: budgetCreateSchema }, async ({ auth, body }) => ({ budget: await createBudget(auth.userId, body) }));
