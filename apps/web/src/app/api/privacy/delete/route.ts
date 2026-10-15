import { privacySourceDeleteSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteSourceData } from "@/server/services/privacy";

export const POST = handler({ body: privacySourceDeleteSchema }, async ({ auth, body }) => ({ deleted: await deleteSourceData(auth.userId, body.source) }));
