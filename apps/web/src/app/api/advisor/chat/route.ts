import { chatRequestSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { sendAdvisorMessage } from "@/server/ai/advisor";
import { userContext } from "@/server/services/users";

export const POST = handler({ body: chatRequestSchema, rateLimit: { key: "advisor", limit: 20, windowMs: 60_000, by: "user" } }, async ({ auth, body }) =>
  sendAdvisorMessage(auth.userId, await userContext(auth.userId), body),
);
