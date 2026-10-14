import { handler } from "@/server/http";
import { deleteDeal } from "@/server/services/shopping";

export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => {
  await deleteDeal(auth.userId, params.id);
  return { ok: true };
});
