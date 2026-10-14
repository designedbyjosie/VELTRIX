import { handler } from "@/server/http";
import { removeFromWatchlist } from "@/server/services/investments";

export const DELETE = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => {
  await removeFromWatchlist(auth.userId, params.id);
  return { ok: true };
});
