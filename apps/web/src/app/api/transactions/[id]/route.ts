import { transactionUpdateSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteTransaction, getTransaction, serializeTxn, updateTransaction } from "@/server/services/transactions";

type P = { id: string };
export const GET = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  const t = await getTransaction(auth.userId, params.id);
  return { transaction: serializeTxn(t), importBatch: t.importBatch ? { id: t.importBatch.id, filename: t.importBatch.filename, createdAt: t.importBatch.createdAt } : null };
});
export const PATCH = handler<typeof transactionUpdateSchema._output, undefined, P>({ body: transactionUpdateSchema }, async ({ auth, body, params }) => ({ transaction: await updateTransaction(auth.userId, params.id, body) }));
export const DELETE = handler<undefined, undefined, P>({}, async ({ auth, params }) => {
  await deleteTransaction(auth.userId, params.id);
  return { ok: true };
});
