import { handler } from "@/server/http";
import { deleteHolding } from "@/server/services/investments";

export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => {
  await deleteHolding(auth.userId, params.id);
  return { ok: true };
});
