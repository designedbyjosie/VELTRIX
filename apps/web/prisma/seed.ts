/**
 * Seeds reference data only (system transaction categories). VELTRIX no longer
 * creates demo users or sample financial records.
 */
import { db } from "../src/server/db";
import { ensureSystemCategories } from "../src/server/services/categories";

async function main() {
  await ensureSystemCategories();
  console.log("Seeded system categories.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
