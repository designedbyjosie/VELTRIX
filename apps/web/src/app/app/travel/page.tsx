import { requireUser } from "@/server/current-user";
import { listTrips } from "@/server/services/travel";
import { TravelView } from "@/components/travel/travel-view";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Travel" };

export default async function TravelPage() {
  const user = await requireUser();
  const trips = await listTrips(user.id);
  return (
    <div className="space-y-5">
      <PageHeader title="Travel" description="Trip budgets, real spending and saved price quotes — the full cost before you book." />
      <TravelView trips={trips} />
    </div>
  );
}
