import { preferenceUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { updatePreferences } from "@/server/services/settings";

export const PATCH = handler({ body: preferenceUpdateSchema }, async ({ auth, body }) => ({ preference: await updatePreferences(auth.userId, body) }));
