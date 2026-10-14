import { memorySettingsSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { setMemoryEnabled } from "@/server/services/memory";

export const PATCH = handler({ body: memorySettingsSchema }, async ({ auth, body }) => ({ enabled: await setMemoryEnabled(auth.userId, body.enabled) }));
