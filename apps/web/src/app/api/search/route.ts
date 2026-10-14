import { z } from "zod";
import { handler } from "@/server/http";
import { globalSearch } from "@/server/services/search";

export const GET = handler({ query: z.object({ q: z.string().trim().min(1).max(80) }), rateLimit: { key: "search", limit: 120, windowMs: 60_000, by: "user" } }, async ({ auth, query }) => globalSearch(auth.userId, query.q));
