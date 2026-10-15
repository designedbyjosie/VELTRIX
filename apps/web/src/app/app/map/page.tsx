import type { Metadata } from "next";
import { requireUser } from "@/server/current-user";
import { opportunityMap } from "@/server/services/opportunity-map";
import { PageHeader } from "@/components/page-header";
import { OpportunityMapView } from "@/components/map/opportunity-map-view";

export const metadata: Metadata = { title: "Opportunity Map" };

export default async function MapPage() {
  const user = await requireUser();
  const map = await opportunityMap(user.id, { timezone: user.timezone, currency: user.baseCurrency });
  return (
    <div className="space-y-5">
      <PageHeader title="Opportunity Map" description="Where you could make meaningful progress, organized around what matters to you. Each area shows where you stand, what's possible, what it takes, and one next step." />
      <OpportunityMapView map={map} />
    </div>
  );
}
