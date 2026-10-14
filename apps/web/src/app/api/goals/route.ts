import { goalCreateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { createGoal, listGoals } from "@/server/services/goals";
import { userContext } from "@/server/services/users";

export const GET = handler({}, async ({ auth }) => ({ goals: await listGoals(auth.userId, (await userContext(auth.userId)).timezone) }));
export const POST = handler({ body: goalCreateSchema }, async ({ auth, body }) => ({ goal: await createGoal(auth.userId, body) }));
