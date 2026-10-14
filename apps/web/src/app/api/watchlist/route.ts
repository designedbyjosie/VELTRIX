import { watchlistAddSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { addToWatchlist, getWatchlist } from "@/server/services/investments";

// Also used by the browser extension (bearer token with the "extension" scope).
export const GET = handler({ auth: "session-or-token", scope: "extension" }, async ({ auth }) => getWatchlist(auth.userId));
export const POST = handler({ auth: "session-or-token", scope: "extension", body: watchlistAddSchema }, async ({ auth, body }) => {
  await addToWatchlist(auth.userId, body.symbol, body.note, auth.kind === "token" ? "EXTENSION" : body.source);
  return { ok: true };
});
