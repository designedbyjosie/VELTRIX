import type { Metadata } from "next";
import { detectPriceIncrease } from "@veltrix/shared";
import { requireUser } from "@/server/current-user";
import { listRecurring, refreshRecurring } from "@/server/services/recurring";
import { listWorkflows, verifyPendingWorkflows } from "@/server/services/workflows";
import { addDays, todayIn } from "@/server/dates";
import { PageHeader } from "@/components/page-header";
import { BillsCenter } from "@/components/bills/bills-center";

export const metadata: Metadata = { title: "Bills & subscriptions" };

const STEP_DAYS = { WEEKLY: 7, MONTHLY: 30.44, QUARTERLY: 91.31, YEARLY: 365.25, UNKNOWN: 0 } as const;

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ start?: string; kind?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const ctx = { timezone: user.timezone, currency: user.baseCurrency };
  await refreshRecurring(user.id, user.timezone);
  await verifyPendingWorkflows(user.id, ctx);
  const [recurring, workflows] = await Promise.all([listRecurring(user.id), listWorkflows(user.id)]);
  const today = todayIn(user.timezone);
  const horizon = addDays(today, 60);

  const items = recurring
    .filter((r) => r.status !== "DISMISSED" || workflows.some((w) => w.recurringId === r.id))
    .map((r) => {
      const latest = Math.abs(r.evidence[r.evidence.length - 1]?.amountCents ?? r.amountCents);
      const change = detectPriceIncrease(r.evidence);
      const wf = workflows.find((w) => w.recurringId === r.id && w.stage !== "abandoned") ?? null;
      return { ...r, latestCents: latest, priceChange: change, workflow: wf };
    });

  // Calendar: project expected charges over the next 60 days from each schedule.
  const calendar: { date: string; merchant: string; amountCents: number; currency: string; recurringId: string; detected: boolean }[] = [];
  for (const r of items) {
    if (!r.nextExpected || r.status === "DISMISSED" || r.frequency === "UNKNOWN") continue;
    let d = r.nextExpected;
    let n = 0;
    while (d <= horizon && n < 10) {
      if (d >= today) calendar.push({ date: d, merchant: r.merchant, amountCents: r.latestCents, currency: r.currency, recurringId: r.id, detected: r.status === "SUSPECTED" });
      n++;
      d = addDays(r.nextExpected, Math.round(STEP_DAYS[r.frequency] * n));
    }
  }
  calendar.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      <PageHeader title="Bills & subscriptions" description="Every recurring charge VELTRIX found in your transactions, what's coming up, and step-by-step plans to cancel or lower them, with outcomes confirmed from your later transactions." />
      <BillsCenter items={items} calendar={calendar} currency={user.baseCurrency} start={sp.start ? { recurringId: sp.start, kind: sp.kind === "negotiate" ? "negotiate" : "cancel" } : null} />
    </div>
  );
}
