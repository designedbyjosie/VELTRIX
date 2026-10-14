import { z } from "zod";
import { handler } from "@/server/http";
import { setKindMuted } from "@/server/services/insights";

const body = z.object({ kind: z.string().min(1).max(40), muted: z.boolean() });
export const POST = handler({ body }, async ({ auth, body }) => ({ muted: await setKindMuted(auth.userId, body.kind, body.muted) }));
