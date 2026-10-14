import { dealCreateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { createDeal, listDeals } from "@/server/services/shopping";

export const GET = handler({}, async ({ auth }) => ({ deals: await listDeals(auth.userId) }));
export const POST = handler({ body: dealCreateSchema }, async ({ auth, body }) => ({ deal: await createDeal(auth.userId, body) }));
