import { accountUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteAccount, updateAccount } from "@/server/services/accounts";

type P = { id: string };
export const PATCH = handler<typeof accountUpdateSchema._output, undefined, P>({ body: accountUpdateSchema }, async ({ auth, body, params }) => ({ account: await updateAccount(auth.userId, params.id, body) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteAccount(auth.userId, params.id);
  return { ok: true };
});
