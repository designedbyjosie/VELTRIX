import { scenarioRequestSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { runWhatIf } from "@/server/services/plan";
import { userContext } from "@/server/services/users";

export const POST = handler({ body: scenarioRequestSchema, rateLimit: { key: "plan-run", limit: 120, windowMs: 60_000, by: "user" } }, async ({ auth, body }) => runWhatIf(auth.userId, body, await userContext(auth.userId)));
