import type { Metadata } from "next";
import { requireUser } from "@/server/current-user";
import { db } from "@/server/db";
import { opportunityOverview, refreshInsights } from "@/server/services/insights";
import { PageHeader } from "@/components/page-header";
import { OpportunitiesView } from "@/components/opportunities/opportunities-view";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const latest = await db.financialInsight.findFirst({ where: { userId: user.id }, orderBy: { generatedAt: "desc" }, select: { generatedAt: true } });
  if (!latest || Date.now() - latest.generatedAt.getTime() > 60 * 60 * 1000) await refreshInsights(user.id, user.timezone, user.baseCurrency);
  const overview = await opportunityOverview(user.id);
  return (
    <div className="space-y-5">
      <PageHeader title="Opportunities" description="Connections across your bills, budgets, goals, trips, saved products and research, each with its evidence, confidence and a next step." />
      <OpportunitiesView initial={overview} currency={user.baseCurrency} />
    </div>
  );
}
