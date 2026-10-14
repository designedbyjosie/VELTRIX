import { z } from "zod";
import { handler } from "@/server/http";
import { fxRate } from "@/server/providers/fx";

const cur = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
export const GET = handler({ query: z.object({ from: cur, to: cur }), rateLimit: { key: "fx", limit: 30, windowMs: 60_000, by: "user" } }, async ({ query }) => {
  const rate = await fxRate(query.from, query.to);
  return { rate, configured: rate !== null || query.from === query.to };
});
