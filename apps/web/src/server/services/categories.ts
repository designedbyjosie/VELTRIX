import { SYSTEM_CATEGORIES } from "@veltrix/shared";
import { db } from "../db";
import { badRequest } from "../errors";

let ensured = false;

/** Idempotently create system categories (userId = null). */
export async function ensureSystemCategories() {
  if (ensured) return;
  for (const c of SYSTEM_CATEGORIES) {
    const existing = await db.transactionCategory.findFirst({ where: { userId: null, slug: c.slug } });
    if (existing && (existing.color !== c.color || existing.name !== c.name || existing.icon !== c.icon)) {
      await db.transactionCategory.update({ where: { id: existing.id }, data: { color: c.color, name: c.name, icon: c.icon } });
    }
    if (!existing) {
      await db.transactionCategory
        .create({ data: { slug: c.slug, name: c.name, kind: c.kind, color: c.color, icon: c.icon } })
        .catch(() => undefined); // concurrent creation is caught by the partial unique index
    }
  }
  ensured = true;
}

export async function listCategories(userId: string) {
  await ensureSystemCategories();
  return db.transactionCategory.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, kind: true, color: true, icon: true, userId: true },
  });
}

export async function categoryBySlug(userId: string) {
  const cats = await listCategories(userId);
  return new Map(cats.map((c) => [c.slug, c]));
}

/** A category is usable only if it is a system category or belongs to the user. */
export async function assertCategory(userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return null;
  const cat = await db.transactionCategory.findFirst({ where: { id: categoryId, OR: [{ userId: null }, { userId }] } });
  if (!cat) throw badRequest("Unknown category.");
  return cat;
}
