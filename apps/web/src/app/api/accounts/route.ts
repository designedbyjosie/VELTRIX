import { accountCreateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { createAccount, listAccounts } from "@/server/services/accounts";

export const GET = handler({}, async ({ auth }) => ({ accounts: await listAccounts(auth.userId) }));
export const POST = handler({ body: accountCreateSchema }, async ({ auth, body }) => ({ account: await createAccount(auth.userId, body) }));
