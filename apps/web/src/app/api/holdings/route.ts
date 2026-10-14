import { holdingCreateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { addHolding } from "@/server/services/investments";

export const POST = handler({ body: holdingCreateSchema }, async ({ auth, body }) => ({ holding: await addHolding(auth.userId, body) }));
