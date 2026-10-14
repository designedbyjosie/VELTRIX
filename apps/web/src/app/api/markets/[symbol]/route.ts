import { z } from "zod";
import { handler } from "@/server/http";
import { marketData } from "@/server/providers/market";
import { notFound, badRequest } from "@/server/errors";

const query = z.object({ range: z.enum(["1M", "3M", "6M", "1Y", "5Y"]).default("1Y") });
export const GET = handler<undefined, typeof query._output, { symbol: string }>({ query, rateLimit: { key: "market-detail", limit: 60, windowMs: 60_000, by: "user" } }, async ({ query, params }) => {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-^]{0,9}$/.test(symbol)) throw badRequest("Invalid symbol.");
  const md = marketData();
  const [profile, quote, history] = await Promise.all([md.profile(symbol), md.quote(symbol), md.history(symbol, query.range)]);
  if (!profile && !quote) throw notFound(`Market data for ${symbol}`);
  return { symbol, profile, quote, history, range: query.range, dataSource: { id: md.id, label: md.label, isDemo: md.isDemo } };
});
