/**
 * Creates (or resets) a test account filled with clearly labelled sample data.
 *
 *   npm run db:seed:demo
 *
 * Email:    DEMO_EMAIL    (default demo@veltrix.app)
 * Password: DEMO_PASSWORD (default "veltrix-demo-2026" on a local database; required otherwise,
 *           because a published default password would let anyone sign in to your live site)
 *
 * Running it again deletes that account's sample records and recreates them with fresh dates.
 * Real users are never touched.
 */
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { ensureSystemCategories } from "../src/server/services/categories";
import { registerUser } from "../src/server/services/users";
import { loadDemoData } from "../src/server/services/demo";

const DEFAULT_PASSWORD = "veltrix-demo-2026";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const email = (process.env.DEMO_EMAIL ?? "demo@veltrix.app").trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD ?? (local ? DEFAULT_PASSWORD : null);
  if (!password) {
    console.error('This database isn\'t local. Choose a password for the test account:\n  DEMO_PASSWORD="something-long-and-private" npm run db:seed:demo');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("DEMO_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }
  const timezone = process.env.DEMO_TIMEZONE ?? "America/New_York";

  await ensureSystemCategories();
  let user = await db.user.findUnique({ where: { email }, include: { profile: true } });
  if (user && !user.profile?.hasDemoData && (await db.transaction.count({ where: { userId: user.id, source: { not: "DEMO" } } })) > 0) {
    console.error(`${email} already has real data. Pick another address with DEMO_EMAIL=...`);
    process.exit(1);
  }
  if (!user) {
    await registerUser({ name: "Alex Demo", email, password, timezone });
    user = await db.user.findUniqueOrThrow({ where: { email }, include: { profile: true } });
  } else {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  }
  // Test account: skip the email confirmation step.
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), failedLoginCount: 0, lockedUntil: null } });
  await db.userProfile.update({ where: { userId: user.id }, data: { timezone } });

  const r = await loadDemoData(user.id, timezone);
  console.log(`Test account ready.\n  Email:    ${email}\n  Password: ${process.env.DEMO_PASSWORD ? "(the DEMO_PASSWORD you set)" : password}\n  Sample transactions: ${r.transactions}\nEverything in it is labelled demo data and can be removed in Settings → Your data.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
