import { handler } from "@/server/http";
import { buildProfile } from "@/server/services/twin";
import { userContext } from "@/server/services/users";

export const GET = handler({}, async ({ auth }) => ({ profile: await buildProfile(auth.userId, await userContext(auth.userId)) }));
