import { z } from "zod";
import { handler } from "@/server/http";
import { setInsightStatus } from "@/server/services/insights";

const body = z.object({ status: z.enum(["DISMISSED", "DONE", "ACTIVE"]) });
type P = { id: string };
export const PATCH = handler<typeof body._output, undefined, P>({ body }, async ({ auth, body, params }) => {
  await setInsightStatus(auth.userId, params.id, body.status);
  return { ok: true };
});
