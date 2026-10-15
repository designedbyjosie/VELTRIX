import { workflowAbandonSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { abandonWorkflow, getWorkflow } from "@/server/services/workflows";
import { userContext } from "@/server/services/users";

export const POST = handler<typeof workflowAbandonSchema._output, undefined, { id: string }>({ body: workflowAbandonSchema }, async ({ auth, body, params }) => {
  await abandonWorkflow(auth.userId, params.id, body.reason);
  return { workflow: await getWorkflow(auth.userId, params.id, await userContext(auth.userId)) };
});
