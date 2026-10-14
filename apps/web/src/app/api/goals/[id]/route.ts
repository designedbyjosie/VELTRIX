import { goalUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteGoal, updateGoal } from "@/server/services/goals";

type P = { id: string };
export const PATCH = handler<typeof goalUpdateSchema._output, undefined, P>({ body: goalUpdateSchema }, async ({ auth, body, params }) => ({ goal: await updateGoal(auth.userId, params.id, body) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteGoal(auth.userId, params.id);
  return { ok: true };
});
