import { planSnapshotCreateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { listPlans, savePlan } from "@/server/services/plan";
import { userContext } from "@/server/services/users";

export const GET = handler({}, async ({ auth }) => ({ plans: await listPlans(auth.userId) }));
export const POST = handler({ body: planSnapshotCreateSchema, rateLimit: { key: "plan-save", limit: 60, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body }) => ({ plan: await savePlan(auth.userId, body, await userContext(auth.userId)) }));
