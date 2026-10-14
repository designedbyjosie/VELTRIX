import { handler } from "@/server/http";
import { deleteTravelExpense } from "@/server/services/travel";

export const DELETE = handler<undefined, undefined, { id: string; eid: string }>({}, async ({ auth, params }) => {
  await deleteTravelExpense(auth.userId, params.id, params.eid);
  return { ok: true };
});
