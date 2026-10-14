import { handler } from "@/server/http";
import { comparePlanWithActual, deletePlan } from "@/server/services/plan";
import { userContext } from "@/server/services/users";

export const GET = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => ({ plan: await comparePlanWithActual(auth.userId, params.id, await userContext(auth.userId)) }));
export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => {
  await deletePlan(auth.userId, params.id);
  return { ok: true };
});
