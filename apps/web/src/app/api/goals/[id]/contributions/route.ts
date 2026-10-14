import { contributionSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { addContribution } from "@/server/services/goals";

type P = { id: string };
export const POST = handler<typeof contributionSchema._output, undefined, P>({ body: contributionSchema }, async ({ auth, body, params }) => ({ contribution: await addContribution(auth.userId, params.id, body) }));
