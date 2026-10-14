/**
 * Seeds system categories and a demo account whose data is clearly tagged as demo.
 *   Email:    demo@veltrix.app
 *   Password: $SEED_DEMO_PASSWORD (default "veltrix-demo-2026") — change it outside local development.
 */
import { db } from "../src/server/db";
import { ensureSystemCategories } from "../src/server/services/categories";
import { registerUser } from "../src/server/services/users";
import { loadDemoData } from "../src/server/services/demo";
import { ensureInstrument } from "../src/server/services/investments";
import { DEMO_SYMBOLS } from "../src/server/providers/market";

async function main() {
  await ensureSystemCategories();
  for (const s of DEMO_SYMBOLS) await ensureInstrument(s);
  const email = "demo@veltrix.app";
  const password = process.env.SEED_DEMO_PASSWORD ?? "veltrix-demo-2026";
  let user = await db.user.findUnique({ where: { email } });
  if (!user) user = await registerUser({ name: "Alex Carter", email, password, timezone: process.env.SEED_TIMEZONE ?? "America/New_York" });
  await db.userProfile.update({ where: { userId: user.id }, data: { plan: "premium" } });
  const r = await loadDemoData(user.id, process.env.SEED_TIMEZONE ?? "America/New_York");
  console.log(`Seeded demo user ${email} with ${r.transactions} demo transactions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
