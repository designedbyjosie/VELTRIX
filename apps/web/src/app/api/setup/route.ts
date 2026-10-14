import { setupSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { audit } from "@/server/audit";
import { completeSetup, setupSuggestions } from "@/server/services/setup";
import { userContext } from "@/server/services/users";

export const GET = handler({}, async ({ auth }) => setupSuggestions(auth.userId, await userContext(auth.userId)));

export const POST = handler({ body: setupSchema, rateLimit: { key: "setup", limit: 20, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body }) => {
  const r = await completeSetup(auth.userId, body, await userContext(auth.userId));
  await audit("setup.completed", { userId: auth.userId, metadata: { path: body.path, accounts: body.accounts.length, budgetLines: body.budget.length, goal: !!body.goal } });
  return r;
});
