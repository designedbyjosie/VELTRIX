import { Suspense } from "react";
import { requireUser } from "@/server/current-user";
import { listProducts } from "@/server/services/shopping";
import { budgetStatusForMonth } from "@/server/services/budgets";
import { todayIn } from "@/server/dates";
import { ShoppingView } from "@/components/shopping/shopping-view";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Shopping" };

export default async function ShoppingPage() {
  const user = await requireUser();
  const [products, budgets] = await Promise.all([listProducts(user.id), budgetStatusForMonth(user.id, todayIn(user.timezone).slice(0, 7), user.timezone)]);
  // Default listing covers wishlist, watching and purchased; archived items are fetched separately.
  const archived = await listProducts(user.id, "ARCHIVED");
  const line = budgets.flatMap((b) => b.lines.map((l) => ({ ...l, currency: b.currency }))).find((l) => l.category.slug === "shopping");
  return (
    <div className="space-y-5">
      <PageHeader title="Shopping" description="Products you're considering, the prices you've actually observed, and how a purchase fits your budget." />
      <Suspense>
        <ShoppingView products={[...products, ...archived]} budget={line ? { remainingCents: line.remainingCents, limitCents: line.limitCents, currency: line.currency } : null} />
      </Suspense>
      <p className="text-[11px] text-ink3">Price verdicts compare against prices recorded in VELTRIX (by you or the extension), not a market-wide history. No merchant price feed is configured.</p>
    </div>
  );
}
