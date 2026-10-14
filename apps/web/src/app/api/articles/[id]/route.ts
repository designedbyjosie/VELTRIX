import { handler } from "@/server/http";
import { deleteArticle } from "@/server/services/articles";

export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => {
  await deleteArticle(auth.userId, params.id);
  return { ok: true };
});
