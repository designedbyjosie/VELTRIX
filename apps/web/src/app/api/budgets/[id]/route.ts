import { budgetUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteBudget, updateBudget } from "@/server/services/budgets";

type P = { id: string };
export const PATCH = handler<typeof budgetUpdateSchema._output, undefined, P>({ body: budgetUpdateSchema }, async ({ auth, body, params }) => ({ budget: await updateBudget(auth.userId, params.id, body) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteBudget(auth.userId, params.id);
  return { ok: true };
});
