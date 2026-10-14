import { csvImportSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { importCsv } from "@/server/services/transactions";
import { audit } from "@/server/audit";

export const POST = handler({ body: csvImportSchema, rateLimit: { key: "csv-import", limit: 30, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body, ip, userAgent }) => {
  const result = await importCsv(auth.userId, body);
  if (!body.dryRun) await audit("data.csv_imported", { userId: auth.userId, ip, userAgent, metadata: { imported: result.imported, duplicates: result.duplicates, errors: result.errorCount } });
  return result;
});
