import { decisionRequestSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { decidePurchase } from "@/server/services/plan";
import { userContext } from "@/server/services/users";

export const POST = handler({ body: decisionRequestSchema, rateLimit: { key: "plan-run", limit: 120, windowMs: 60_000, by: "user" } }, async ({ auth, body }) => ({ decision: await decidePurchase(auth.userId, body, await userContext(auth.userId)) }));
