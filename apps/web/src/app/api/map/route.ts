import { mapPrefsSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { opportunityMap, setMapPreferences } from "@/server/services/opportunity-map";
import { userContext } from "@/server/services/users";

export const GET = handler({}, async ({ auth }) => opportunityMap(auth.userId, await userContext(auth.userId)));
/** `{focus?, hidden?}`: the areas that matter most (in order, up to 3) and the ones that don't. */
export const PATCH = handler({ body: mapPrefsSchema }, async ({ auth, body }) => ({ prefs: await setMapPreferences(auth.userId, body) }));
