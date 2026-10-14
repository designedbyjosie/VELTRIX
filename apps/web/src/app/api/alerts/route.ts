import { alertCreateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { createAlert, listAlerts } from "@/server/services/investments";

export const GET = handler({}, async ({ auth }) => ({ alerts: await listAlerts(auth.userId) }));
export const POST = handler({ body: alertCreateSchema }, async ({ auth, body }) => ({ alert: await createAlert(auth.userId, body) }));
