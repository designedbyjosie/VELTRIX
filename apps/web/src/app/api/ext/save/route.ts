import { extensionSaveSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { EXTENSION_SCOPE, saveFromExtension } from "@/server/services/extension";

export const POST = handler({ auth: "session-or-token", scope: EXTENSION_SCOPE, body: extensionSaveSchema, rateLimit: { key: "ext-save", limit: 60, windowMs: 60_000, by: "user" } }, async ({ auth, body }) =>
  saveFromExtension(auth.userId, body),
);
