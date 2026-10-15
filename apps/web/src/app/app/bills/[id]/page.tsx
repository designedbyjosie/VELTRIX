import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/current-user";
import { verifyWorkflow } from "@/server/services/workflows";
import { HttpError } from "@/server/errors";
import { todayIn } from "@/server/dates";
import { WorkflowPage } from "@/components/bills/workflow-view";

export const metadata: Metadata = { title: "Savings plan" };

export default async function WorkflowRoute({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ctx = { timezone: user.timezone, currency: user.baseCurrency };
  let w;
  try {
    // Re-check the outcome on every visit; it's idempotent.
    w = await verifyWorkflow(user.id, id, ctx);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  return (
    <div className="space-y-4">
      <Link href="/app/bills" className="text-sm text-cyan hover:underline">
        ← Bills & subscriptions
      </Link>
      <WorkflowPage initial={w} today={todayIn(user.timezone)} />
    </div>
  );
}
