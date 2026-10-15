import { scheduleDelivery, type NotifyFrequency } from "@veltrix/shared";
import { db } from "../db";
import { notFound } from "../errors";

const PREF_FOR_KIND: Record<string, "notifyBudget" | "notifyPriceDrops" | "notifyGoals"> = { budget: "notifyBudget", price_drop: "notifyPriceDrops", goal: "notifyGoals" };

/**
 * Create a notification once per dedupe key, respecting the user's choices: per-kind switches,
 * frequency (immediate / digest / off), quiet hours and a pause. Paused or "off" notifications are
 * not created at all; held ones are stored with a later `deliverAt` and stay hidden until then.
 */
export async function notify(userId: string, n: { kind: string; title: string; body: string; link?: string; dedupeKey: string }, now = new Date()) {
  const [p, profile] = await Promise.all([db.userPreference.findUnique({ where: { userId } }), db.userProfile.findUnique({ where: { userId }, select: { timezone: true } })]);
  const pref = PREF_FOR_KIND[n.kind];
  if (pref && p && p[pref] === false) return;
  const decision = scheduleDelivery(now, profile?.timezone ?? "UTC", {
    frequency: (p?.notifyFrequency ?? "immediate") as NotifyFrequency,
    quietStart: p?.quietHoursStart ?? null,
    quietEnd: p?.quietHoursEnd ?? null,
    pausedUntil: p?.notificationsPausedUntil ?? null,
  });
  if (!decision.deliver) return;
  await db.notification.upsert({
    where: { userId_dedupeKey: { userId, dedupeKey: n.dedupeKey } },
    create: { userId, kind: n.kind, title: n.title, body: n.body, link: n.link, dedupeKey: n.dedupeKey, deliverAt: decision.at },
    update: {},
  });
}

export async function listNotifications(userId: string, limit = 20) {
  const visible = { userId, deliverAt: { lte: new Date() } };
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: visible, orderBy: { deliverAt: "desc" }, take: limit }),
    db.notification.count({ where: { ...visible, readAt: null } }),
  ]);
  return { unread, items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.readAt, createdAt: n.deliverAt.toISOString() })) };
}

/** Notifications waiting for quiet hours to end or for the next digest. */
export async function heldNotifications(userId: string) {
  const rows = await db.notification.findMany({ where: { userId, deliverAt: { gt: new Date() } }, orderBy: { deliverAt: "asc" }, take: 50 });
  return rows.map((n) => ({ id: n.id, kind: n.kind, title: n.title, deliverAt: n.deliverAt.toISOString() }));
}

/** Show held notifications now (used when the user wants them without waiting). */
export async function releaseHeld(userId: string) {
  const r = await db.notification.updateMany({ where: { userId, deliverAt: { gt: new Date() } }, data: { deliverAt: new Date() } });
  return r.count;
}

export async function markRead(userId: string, id: string | "all") {
  if (id === "all") {
    await db.notification.updateMany({ where: { userId, readAt: null, deliverAt: { lte: new Date() } }, data: { readAt: new Date() } });
    return;
  }
  const n = await db.notification.findFirst({ where: { id, userId } });
  if (!n) throw notFound("Notification");
  await db.notification.update({ where: { id }, data: { readAt: new Date() } });
}
