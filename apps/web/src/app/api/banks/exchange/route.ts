import { z } from "zod";
import { handler } from "@/server/http";
import { connectItem } from "@/server/services/banking";
import { userContext } from "@/server/services/users";

const body = z.object({ publicToken: z.string().min(10).max(300), institution: z.object({ id: z.string().max(64).nullable(), name: z.string().trim().max(120) }) });
export const POST = handler({ body, rateLimit: { key: "plaid-exchange", limit: 20, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body }) =>
  connectItem(auth.userId, body.publicToken, body.institution, (await userContext(auth.userId)).timezone),
);
