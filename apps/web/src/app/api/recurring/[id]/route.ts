import { recurringUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { setRecurringStatus } from "@/server/services/recurring";

type P = { id: string };
export const PATCH = handler<typeof recurringUpdateSchema._output, undefined, P>({ body: recurringUpdateSchema }, async ({ auth, body, params }) => ({ item: await setRecurringStatus(auth.userId, params.id, body.status) }));
