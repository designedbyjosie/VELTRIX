import { tripCreateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { createTrip, listTrips } from "@/server/services/travel";

export const GET = handler({ auth: "session-or-token", scope: "extension" }, async ({ auth }) => ({ trips: await listTrips(auth.userId) }));
export const POST = handler({ body: tripCreateSchema }, async ({ auth, body }) => ({ trip: await createTrip(auth.userId, body) }));
