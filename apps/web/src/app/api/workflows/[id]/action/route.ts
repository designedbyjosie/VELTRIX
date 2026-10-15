import { workflowActionSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { recordAction } from "@/server/services/workflows";
import { userContext } from "@/server/services/users";

export const POST = handler<typeof workflowActionSchema._output, undefined, { id: string }>({ body: workflowActionSchema }, async ({ auth, body, params }) => ({ workflow: await recordAction(auth.userId, params.id, body, await userContext(auth.userId)) }));
