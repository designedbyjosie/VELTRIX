import { z } from "zod";
import { handler } from "@/server/http";
import { marketData } from "@/server/providers/market";

export const GET = handler({ query: z.object({ q: z.string().trim().max(40).default("") }), rateLimit: { key: "market-search", limit: 60, windowMs: 60_000, by: "user" } }, async ({ query }) => {
  const md = marketData();
  return { results: await md.search(query.q), dataSource: { id: md.id, label: md.label, isDemo: md.isDemo } };
});
