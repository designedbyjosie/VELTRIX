import { rewardProgramSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { listRewards, upsertReward } from "@/server/services/shopping";

export const GET = handler({}, async ({ auth }) => ({ rewards: await listRewards(auth.userId) }));
export const POST = handler({ body: rewardProgramSchema }, async ({ auth, body }) => ({ reward: await upsertReward(auth.userId, body) }));
