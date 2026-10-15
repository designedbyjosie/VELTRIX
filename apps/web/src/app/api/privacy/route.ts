import { handler } from "@/server/http";
import { privacyOverview } from "@/server/services/privacy";

export const GET = handler({}, async ({ auth }) => privacyOverview(auth.userId));
