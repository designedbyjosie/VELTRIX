import { handler } from "@/server/http";
import { dismissAction } from "@/server/services/advisor-actions";

export const POST = handler<undefined, undefined, { id: string }>({}, async ({ auth, params }) => ({ action: await dismissAction(auth.userId, params.id) }));
