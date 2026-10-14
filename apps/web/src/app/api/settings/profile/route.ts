import { profileUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { updateProfile } from "@/server/services/settings";
import { getProfile } from "@/server/services/users";

export const GET = handler({}, async ({ auth }) => ({ profile: await getProfile(auth.userId) }));
export const PATCH = handler({ body: profileUpdateSchema }, async ({ auth, body }) => {
  await updateProfile(auth.userId, body);
  return { profile: await getProfile(auth.userId) };
});
