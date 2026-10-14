import { db } from "../db";
import { hashPassword, verifyPassword } from "../auth/password";
import { conflict } from "../errors";
import { ensureSystemCategories } from "./categories";

export const CONSENT_VERSION = "2026-10";

export async function registerUser(input: { name: string; email: string; password: string; timezone?: string }) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with this email already exists. Sign in instead.");
  await ensureSystemCategories();
  const passwordHash = await hashPassword(input.password);
  return db.user.create({
    data: {
      email: input.email,
      passwordHash,
      profile: { create: { displayName: input.name, timezone: input.timezone ?? "UTC" } },
      preference: { create: {} },
      watchlists: { create: { name: "My watchlist", isDefault: true } },
    },
  });
}

export async function authenticateUser(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  return ok ? user : null;
}

/** Latest consent per purpose. Absent = not granted (opt-in). */
export async function getConsents(userId: string): Promise<Record<string, boolean>> {
  const rows = await db.consentRecord.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const out: Record<string, boolean> = { AI_PROCESSING: false, EXTENSION_PAGE_CONTENT: false, PRICE_TRACKING: false, PRODUCT_EMAILS: false };
  for (const r of rows) out[r.purpose] = r.granted;
  return out;
}

export async function hasConsent(userId: string, purpose: "AI_PROCESSING" | "EXTENSION_PAGE_CONTENT" | "PRICE_TRACKING" | "PRODUCT_EMAILS") {
  const latest = await db.consentRecord.findFirst({ where: { userId, purpose }, orderBy: { createdAt: "desc" } });
  return latest?.granted ?? false;
}

export async function setConsent(userId: string, purpose: "AI_PROCESSING" | "EXTENSION_PAGE_CONTENT" | "PRICE_TRACKING" | "PRODUCT_EMAILS", granted: boolean) {
  return db.consentRecord.create({ data: { userId, purpose, granted, version: CONSENT_VERSION } });
}

export async function getProfile(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true, preference: true } });
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? "",
    baseCurrency: user.profile?.baseCurrency ?? "USD",
    timezone: user.profile?.timezone ?? "UTC",
    hasDemoData: user.profile?.hasDemoData ?? false,
    preference: user.preference,
  };
}

/** Timezone and base currency used by calculations for this user. */
export async function userContext(userId: string) {
  const p = await db.userProfile.findUnique({ where: { userId } });
  return { timezone: p?.timezone ?? "UTC", currency: p?.baseCurrency ?? "USD" };
}
