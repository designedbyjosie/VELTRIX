import { planningAssumptionsSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { badRequest } from "@/server/errors";
import { db } from "@/server/db";
import { saveAssumptions } from "@/server/services/twin";

export const PATCH = handler({ body: planningAssumptionsSchema }, async ({ auth, body }) => {
  // Account ids referenced in assumptions must belong to the user.
  const ids = [...(body.excludedAccountIds ?? []), ...Object.keys(body.debts ?? {})];
  if (ids.length) {
    const owned = await db.connectedAccount.count({ where: { userId: auth.userId, id: { in: [...new Set(ids)] } } });
    if (owned !== new Set(ids).size) throw badRequest("Unknown account.");
  }
  return { assumptions: await saveAssumptions(auth.userId, body) };
});
