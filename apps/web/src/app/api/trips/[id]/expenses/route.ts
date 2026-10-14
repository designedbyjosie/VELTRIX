import { travelExpenseSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { addTravelExpense } from "@/server/services/travel";

type P = { id: string };
export const POST = handler<typeof travelExpenseSchema._output, undefined, P>({ body: travelExpenseSchema }, async ({ auth, body, params }) => ({ expense: await addTravelExpense(auth.userId, params.id, body) }));
