import type { Metadata } from "next";
import { requireUser } from "@/server/current-user";
import { listMemory } from "@/server/services/memory";
import { PageHeader } from "@/components/page-header";
import { MemoryView } from "@/components/memory/memory-view";

export const metadata: Metadata = { title: "Memory" };

export default async function MemoryPage() {
  const user = await requireUser();
  return (
    <div className="space-y-5">
      <PageHeader title="Financial memory" description="Preferences and goals you chose to save. You decide what's remembered, what's used, and what's forgotten." />
      <MemoryView initial={await listMemory(user.id)} />
    </div>
  );
}
