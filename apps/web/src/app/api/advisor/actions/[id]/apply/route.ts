import { handler } from "@/server/http";
import { applyAction } from "@/server/services/advisor-actions";
import { userContext } from "@/server/services/users";

export const POST = handler<undefined, undefined, { id: string }>({ rateLimit: { key: "advisor-apply", limit: 60, windowMs: 60_000, by: "user" } }, async ({ auth, params }) => ({
  action: await applyAction(auth.userId, params.id, await userContext(auth.userId)),
}));
