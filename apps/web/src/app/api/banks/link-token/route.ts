import { z } from "zod";
import { handler } from "@/server/http";
import { createLinkToken } from "@/server/services/banking";
import { PlaidError } from "@/server/providers/plaid";
import { HttpError } from "@/server/errors";

const body = z.object({ itemId: z.string().min(1).max(64).optional() });
export const POST = handler({ body, rateLimit: { key: "plaid-link", limit: 20, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body }) => {
  try {
    return await createLinkToken(auth.userId, body.itemId);
  } catch (e) {
    if (e instanceof PlaidError) throw new HttpError(502, "plaid_error", e.displayMessage ?? "Couldn't start the bank connection. Try again.");
    throw e;
  }
});
