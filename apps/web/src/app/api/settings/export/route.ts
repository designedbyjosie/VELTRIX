import { z } from "zod";
import { handler } from "@/server/http";
import { exportTransactionsCsv, exportUserData } from "@/server/services/settings";
import { audit } from "@/server/audit";

export const GET = handler({ query: z.object({ format: z.enum(["json", "csv"]).default("json") }), rateLimit: { key: "export", limit: 10, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, query, ip, userAgent }) => {
  await audit("data.exported", { userId: auth.userId, ip, userAgent, metadata: { format: query.format } });
  const stamp = new Date().toISOString().slice(0, 10);
  if (query.format === "csv") {
    return new Response(await exportTransactionsCsv(auth.userId), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="veltrix-transactions-${stamp}.csv"`, "cache-control": "no-store" },
    });
  }
  const data = await exportUserData(auth.userId);
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="veltrix-export-${stamp}.json"`, "cache-control": "no-store" },
  });
});
