import { handler } from "@/server/http";
import { deleteContribution } from "@/server/services/goals";

type P = { id: string; cid: string };
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteContribution(auth.userId, params.id, params.cid);
  return { ok: true };
});
