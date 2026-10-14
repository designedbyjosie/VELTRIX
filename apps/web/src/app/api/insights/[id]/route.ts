import { z } from "zod";
import { handler } from "@/server/http";
import { OUTCOMES, setInsightStatus } from "@/server/services/insights";

const body = z.object({ status: z.enum(["DISMISSED", "DONE", "ACTIVE", "FOLLOWING"]), outcome: z.enum(OUTCOMES).nullable().optional() });
type P = { id: string };
export const PATCH = handler<typeof body._output, undefined, P>({ body }, async ({ auth, body, params }) => {
  await setInsightStatus(auth.userId, params.id, body.status, body.outcome);
  return { ok: true };
});
