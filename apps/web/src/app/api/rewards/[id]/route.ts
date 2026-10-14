import { rewardProgramSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteReward, upsertReward } from "@/server/services/shopping";

type P = { id: string };
export const PATCH = handler<typeof rewardProgramSchema._output, undefined, P>({ body: rewardProgramSchema }, async ({ auth, body, params }) => ({ reward: await upsertReward(auth.userId, body, params.id) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteReward(auth.userId, params.id);
  return { ok: true };
});
