import type { Metadata } from "next";
import { requireUser } from "@/server/current-user";
import { buildProfile } from "@/server/services/twin";
import { PageHeader } from "@/components/page-header";
import { PlanLab } from "@/components/plan/plan-lab";

export const metadata: Metadata = { title: "What-if Lab" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ tab?: string; preset?: string; item?: string; price?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const profile = await buildProfile(user.id, { timezone: user.timezone, currency: user.baseCurrency });
  return (
    <div className="space-y-5">
      <PageHeader title="What-if Lab" description="See the consequences of a decision before you make it. Every projection is built from your own data and the assumptions shown." />
      <PlanLab profile={profile} tab={sp.tab ?? null} preset={sp.preset ?? null} purchase={sp.item || sp.price ? { label: sp.item?.slice(0, 80), price: sp.price?.slice(0, 14) } : undefined} />
    </div>
  );
}
