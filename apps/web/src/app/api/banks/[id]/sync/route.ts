import { handler } from "@/server/http";
import { syncItem } from "@/server/services/banking";
import { userContext } from "@/server/services/users";

export const POST = handler<undefined, undefined, { id: string }>({ rateLimit: { key: "plaid-sync", limit: 30, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, params }) =>
  syncItem(auth.userId, params.id, (await userContext(auth.userId)).timezone),
);
