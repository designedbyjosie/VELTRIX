/** Session lookup for Server Components and layouts. */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { resolveSession, SESSION_COOKIE } from "./auth/session";

export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const ctx = await resolveSession(store.get(SESSION_COOKIE)?.value);
  if (!ctx) return null;
  const user = await db.user.findUnique({ where: { id: ctx.userId }, include: { profile: true, preference: true } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? user.email.split("@")[0],
    baseCurrency: user.profile?.baseCurrency ?? "USD",
    timezone: user.profile?.timezone ?? "UTC",
    plan: user.profile?.plan ?? "free",
    hasDemoData: user.profile?.hasDemoData ?? false,
    preference: user.preference,
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
