import { handler } from "@/server/http";
import { listItems } from "@/server/services/banking";
import { plaidConfigured } from "@/server/providers/plaid";

export const GET = handler({}, async ({ auth }) => ({ configured: plaidConfigured(), items: await listItems(auth.userId) }));
