import { handler } from "@/server/http";
import { deleteConversation, getConversation } from "@/server/ai/advisor";

type P = { id: string };
export const GET = handler<undefined, undefined, P>({}, async ({ auth, params }) => ({ conversation: await getConversation(auth.userId, params.id) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteConversation(auth.userId, params.id);
  return { ok: true };
});
