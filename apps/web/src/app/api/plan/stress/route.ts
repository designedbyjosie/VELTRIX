import { stressRequestSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { stressTest } from "@/server/services/plan";
import { userContext } from "@/server/services/users";

export const POST = handler({ body: stressRequestSchema, rateLimit: { key: "plan-run", limit: 120, windowMs: 60_000, by: "user" } }, async ({ auth, body }) => stressTest(auth.userId, body, await userContext(auth.userId)));
