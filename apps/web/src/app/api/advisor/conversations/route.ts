import { handler } from "@/server/http";
import { advisorStatus, listConversations } from "@/server/ai/advisor";

export const GET = handler({}, async ({ auth }) => ({ conversations: await listConversations(auth.userId), status: await advisorStatus(auth.userId) }));
