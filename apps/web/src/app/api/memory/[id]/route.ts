import { memoryUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteMemory, updateMemory } from "@/server/services/memory";

type P = { id: string };
export const PATCH = handler<typeof memoryUpdateSchema._output, undefined, P>({ body: memoryUpdateSchema }, async ({ auth, body, params }) => ({ item: await updateMemory(auth.userId, params.id, body) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteMemory(auth.userId, params.id);
  return { ok: true };
});
