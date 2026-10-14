/**
 * Scheduled maintenance: bank syncs, price alerts, recurring-charge detection and insight refresh
 * for every user. Call from a scheduler with `Authorization: Bearer $CRON_SECRET`.
 * GET is accepted too because Vercel Cron Jobs send GET requests with that header.
 */
import { timingSafeEqual } from "node:crypto";
import { handler } from "@/server/http";
import { db } from "@/server/db";
import { HttpError } from "@/server/errors";
import { checkAlerts } from "@/server/services/investments";
import { refreshInsights } from "@/server/services/insights";
import { syncAllItems } from "@/server/services/banking";
import { plaidConfigured } from "@/server/providers/plaid";

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const run = handler({ auth: "none" }, async ({ req }) => {
  if (!authorized(req.headers.get("authorization"))) throw new HttpError(401, "unauthorized", "Invalid job credentials.");
  const banks = plaidConfigured() ? await syncAllItems() : null;
  const users = await db.user.findMany({ select: { id: true, profile: { select: { timezone: true, baseCurrency: true } } } });
  let alerts = 0;
  for (const u of users) {
    alerts += await checkAlerts(u.id);
    await refreshInsights(u.id, u.profile?.timezone ?? "UTC", u.profile?.baseCurrency ?? "USD");
  }
  return { users: users.length, alertsTriggered: alerts, banks, ranAt: new Date().toISOString() };
});

export const POST = run;
export const GET = run;
