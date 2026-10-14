import { handler } from "@/server/http";
import { removeItem } from "@/server/services/banking";

export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => {
  await removeItem(auth.userId, params.id);
  return { ok: true };
});
