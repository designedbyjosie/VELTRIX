import { handler } from "@/server/http";
import { listApiTokens, listAuditEvents, listSessions } from "@/server/services/settings";

export const GET = handler({}, async ({ auth }) => ({
  sessions: await listSessions(auth.userId, auth.sessionId),
  tokens: await listApiTokens(auth.userId),
  events: await listAuditEvents(auth.userId),
}));
