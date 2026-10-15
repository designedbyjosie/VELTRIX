import { workflowStartSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { outcomeLedger, prepareWorkflow } from "@/server/services/workflows";

export const GET = handler({}, async ({ auth }) => outcomeLedger(auth.userId));
export const POST = handler({ body: workflowStartSchema, rateLimit: { key: "workflow-start", limit: 60, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body }) => prepareWorkflow(auth.userId, body.recurringId, body.kind));
