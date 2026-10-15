/**
 * Scheduled maintenance: bank syncs, price alerts, recurring-charge detection, opportunity refresh
 * and outcome verification
 * for every user. Call from a scheduler with `Authorization: Bearer $CRON_SECRET`.
 * GET is accepted too because Vercel Cron Jobs send GET requests with that header.
 */
import { timingSafeEqual } from "node:crypto";
import { handler } from "@/server/http";
import { db } from "@/server/db";
import { HttpError } from "@/server/errors";
import { checkAlerts } from "@/server/services/investments";
import { refreshInsights } from "@/server/services/insights";
import { verifyPendingWorkflows } from "@/server/services/workflows";
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
  let outcomesChecked = 0;
  const failures: string[] = [];
  for (const u of users) {
    const ctx = { timezone: u.profile?.timezone ?? "UTC", currency: u.profile?.baseCurrency ?? "USD" };
    // One user's failure must not stop everyone else's checks.
    try {
      alerts += await checkAlerts(u.id);
      await refreshInsights(u.id, ctx.timezone, ctx.currency);
      outcomesChecked += await verifyPendingWorkflows(u.id, ctx);
    } catch (err) {
      console.error("[jobs] user run failed", u.id, err);
      failures.push(u.id);
    }
  }
  return { users: users.length, alertsTriggered: alerts, outcomesChecked, failedUsers: failures.length, banks, ranAt: new Date().toISOString() };
});

export const POST = run;
export const GET = run;
