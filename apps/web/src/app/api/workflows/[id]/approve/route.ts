import { handler } from "@/server/http";
import { approveWorkflow, getWorkflow } from "@/server/services/workflows";
import { userContext } from "@/server/services/users";

export const POST = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => {
  await approveWorkflow(auth.userId, params.id);
  return { workflow: await getWorkflow(auth.userId, params.id, await userContext(auth.userId)) };
});
