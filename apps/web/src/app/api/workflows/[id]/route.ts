import { workflowUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { getWorkflow, updateWorkflow } from "@/server/services/workflows";
import { userContext } from "@/server/services/users";

type P = { id: string };
export const GET = handler<undefined, undefined, P>({}, async ({ auth, params }) => ({ workflow: await getWorkflow(auth.userId, params.id, await userContext(auth.userId)) }));
export const PATCH = handler<typeof workflowUpdateSchema._output, undefined, P>({ body: workflowUpdateSchema }, async ({ auth, body, params }) => {
  await updateWorkflow(auth.userId, params.id, body);
  return { workflow: await getWorkflow(auth.userId, params.id, await userContext(auth.userId)) };
});
