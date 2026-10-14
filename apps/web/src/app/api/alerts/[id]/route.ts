import { handler } from "@/server/http";
import { deleteAlert } from "@/server/services/investments";

export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => {
  await deleteAlert(auth.userId, params.id);
  return { ok: true };
});
