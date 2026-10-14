import { Suspense } from "react";
import { requireUser } from "@/server/current-user";
import { listGoals } from "@/server/services/goals";
import { GoalsView } from "@/components/goals/goals-view";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const goals = await listGoals(user.id, user.timezone);
  return (
    <div className="space-y-5">
      <PageHeader title="Goals" description="Targets, dates and the monthly amount needed to reach them. Projections assume no investment growth." />
      <Suspense>
        <GoalsView goals={goals} />
      </Suspense>
    </div>
  );
}
