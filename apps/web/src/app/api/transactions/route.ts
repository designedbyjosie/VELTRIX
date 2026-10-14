import { transactionCreateSchema, transactionQuerySchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { createTransaction, listTransactions } from "@/server/services/transactions";

export const GET = handler({ query: transactionQuerySchema }, async ({ auth, query }) => listTransactions(auth.userId, query));
export const POST = handler({ body: transactionCreateSchema }, async ({ auth, body }) => ({ transaction: await createTransaction(auth.userId, body) }));
