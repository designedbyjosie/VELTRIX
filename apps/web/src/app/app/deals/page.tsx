import { requireUser } from "@/server/current-user";
import { listDeals, listRewards } from "@/server/services/shopping";
import { DealsView } from "@/components/deals/deals-view";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Deals & Rewards" };

export default async function DealsPage() {
  const user = await requireUser();
  const [deals, rewards] = await Promise.all([listDeals(user.id), listRewards(user.id)]);
  return (
    <div className="space-y-5">
      <PageHeader title="Deals & Rewards" description="Verified price drops on products you track, coupons you've found, and the value of your points. Nothing here is a guarantee — check terms at checkout." />
      <DealsView deals={deals} rewards={rewards} />
    </div>
  );
}
