import { handler } from "@/server/http";
import { verifyWorkflow } from "@/server/services/workflows";
import { userContext } from "@/server/services/users";

export const POST = handler<undefined, undefined, { id: string }>({ rateLimit: { key: "workflow-verify", limit: 60, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, params }) => ({ workflow: await verifyWorkflow(auth.userId, params.id, await userContext(auth.userId)) }));
