import { tripUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteTrip, updateTrip } from "@/server/services/travel";

type P = { id: string };
export const PATCH = handler<typeof tripUpdateSchema._output, undefined, P>({ body: tripUpdateSchema }, async ({ auth, body, params }) => ({ trip: await updateTrip(auth.userId, params.id, body) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteTrip(auth.userId, params.id);
  return { ok: true };
});
