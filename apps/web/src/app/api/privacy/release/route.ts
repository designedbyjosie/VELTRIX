import { handler } from "@/server/http";
import { releaseHeld } from "@/server/services/notifications";

/** Show notifications held by quiet hours or a digest right away. */
export const POST = handler({}, async ({ auth }) => ({ released: await releaseHeld(auth.userId) }));
