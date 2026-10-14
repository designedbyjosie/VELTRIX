import { db } from "../db";
import { notFound } from "../errors";

const PREF_FOR_KIND: Record<string, "notifyBudget" | "notifyPriceDrops" | "notifyGoals"> = { budget: "notifyBudget", price_drop: "notifyPriceDrops", goal: "notifyGoals" };

/** Create a notification once per dedupe key, respecting the user's notification preferences. */
export async function notify(userId: string, n: { kind: string; title: string; body: string; link?: string; dedupeKey: string }) {
  const pref = PREF_FOR_KIND[n.kind];
  if (pref) {
    const p = await db.userPreference.findUnique({ where: { userId } });
    if (p && p[pref] === false) return;
  }
  await db.notification.upsert({
    where: { userId_dedupeKey: { userId, dedupeKey: n.dedupeKey } },
    create: { userId, kind: n.kind, title: n.title, body: n.body, link: n.link, dedupeKey: n.dedupeKey },
    update: {},
  });
}

export async function listNotifications(userId: string, limit = 20) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { unread, items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.readAt, createdAt: n.createdAt.toISOString() })) };
}

export async function markRead(userId: string, id: string | "all") {
  if (id === "all") {
    await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return;
  }
  const n = await db.notification.findFirst({ where: { id, userId } });
  if (!n) throw notFound("Notification");
  await db.notification.update({ where: { id }, data: { readAt: new Date() } });
}
