import { pageExtractionSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { analyzePage, EXTENSION_SCOPE } from "@/server/services/extension";
import { userContext } from "@/server/services/users";

export const POST = handler({ auth: "session-or-token", scope: EXTENSION_SCOPE, body: pageExtractionSchema, rateLimit: { key: "ext-analyze", limit: 60, windowMs: 60_000, by: "user" } }, async ({ auth, body }) => {
  const ctx = await userContext(auth.userId);
  return analyzePage(auth.userId, body, ctx.timezone, ctx.currency);
});
