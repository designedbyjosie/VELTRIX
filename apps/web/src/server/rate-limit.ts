/**
 * Fixed-window rate limiting stored in PostgreSQL, so limits hold across every
 * server instance (serverless deployments run many). One atomic upsert per check.
 */
import { db } from "./db";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const k = key.slice(0, 200);
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${k}, 1, now() + (${windowMs} * interval '1 millisecond'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN now() + (${windowMs} * interval '1 millisecond') ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const { count, resetAt } = rows[0];
  // Opportunistic cleanup of expired buckets (~1% of calls).
  if (Math.random() < 0.01) await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 3_600_000) } } }).catch(() => undefined);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)) };
}

/** Test helper: clear all buckets. */
export async function resetRateLimits() {
  await db.rateLimitBucket.deleteMany({});
}
