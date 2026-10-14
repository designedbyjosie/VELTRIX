import { Suspense } from "react";
import { requireUser } from "@/server/current-user";
import { advisorStatus, listConversations } from "@/server/ai/advisor";
import { listInsights } from "@/server/services/insights";
import { listMemory } from "@/server/services/memory";
import { AdvisorChat } from "@/components/advisor/advisor-chat";
import { InsightCard } from "@/components/dashboard/insight-card";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "AI Advisor" };

export default async function AdvisorPage() {
  const user = await requireUser();
  const [status, conversations, insights, memory] = await Promise.all([advisorStatus(user.id), listConversations(user.id), listInsights(user.id), listMemory(user.id)]);
  return (
    <div className="space-y-5">
      <PageHeader title="AI Advisor" description="Questions answered from your own data, with every source shown." />
      <Suspense>
        <AdvisorChat status={status} memory={{ enabled: memory.enabled, active: memory.enabled ? memory.items.filter((m) => m.enabled).length : 0 }} conversations={conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }))} />
      </Suspense>
      <Card id="insights" title="Current opportunities">
        {insights.length === 0 ? (
          <p className="text-sm text-ink2">No recommendations right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
