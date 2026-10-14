import { handler } from "@/server/http";
import { extensionMe, EXTENSION_SCOPE } from "@/server/services/extension";

export const GET = handler({ auth: "session-or-token", scope: EXTENSION_SCOPE }, async ({ auth }) => extensionMe(auth.userId));
