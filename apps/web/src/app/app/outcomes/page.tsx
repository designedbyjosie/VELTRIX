import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/current-user";
import { outcomeLedger, verifyPendingWorkflows } from "@/server/services/workflows";
import { refreshInsights } from "@/server/services/insights";
import { db } from "@/server/db";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, EmptyState } from "@/components/ui";
import { money, shortDate } from "@/lib/format";
import { STAGE_LABEL } from "@/components/bills/stages";

export const metadata: Metadata = { title: "Outcome ledger" };

export default async function OutcomesPage() {
  const user = await requireUser();
  await verifyPendingWorkflows(user.id, { timezone: user.timezone, currency: user.baseCurrency });
  // "Identified" comes from opportunities; refresh them if they're more than an hour old.
  const latest = await db.financialInsight.findFirst({ where: { userId: user.id }, orderBy: { generatedAt: "desc" }, select: { generatedAt: true } });
  if (!latest || Date.now() - latest.generatedAt.getTime() > 60 * 60 * 1000) await refreshInsights(user.id, user.timezone, user.baseCurrency);
  const { totals: t, workflows } = await outcomeLedger(user.id);
  const c = user.baseCurrency;
  const tiles = [
    { label: "Possible savings identified", value: `${money(t.identified.estimatedAnnualCents, c, { noCents: true })}/yr`, sub: `${t.identified.count} opportunit${t.identified.count === 1 ? "y" : "ies"} not yet acted on · estimate`, href: "/app/opportunities", tone: "text-ink" },
    { label: "Planned", value: `${money(t.planned.estimatedAnnualCents, c, { noCents: true })}/yr`, sub: `${t.planned.count} plan${t.planned.count === 1 ? "" : "s"} prepared or approved · estimate`, tone: "text-ink" },
    { label: "Action taken, awaiting confirmation", value: `${money(t.initiated.estimatedAnnualCents, c, { noCents: true })}/yr`, sub: `${t.initiated.count} in progress · estimate until confirmed`, tone: "text-warn" },
    { label: "Confirmed ongoing effect", value: `${money(t.confirmed.confirmedAnnualCents, c, { noCents: true })}/yr`, sub: `${t.confirmed.count} confirmed from your transactions`, tone: "text-pos" },
    { label: "Money actually not spent so far", value: money(t.realizedCents, c), sub: "Charges that stopped or dropped, counted only after they were expected", tone: "text-pos" },
    { label: "Not confirmed", value: String(t.notConfirmed.count), sub: "Charged again or no lower price seen", tone: t.notConfirmed.count ? "text-neg" : "text-ink" },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Outcome ledger" description="What you've pursued with VELTRIX and what actually happened. Estimates, actions and confirmed results are kept separate and never added together." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((x) => {
          const body = (
            <>
              <p className="text-xs text-ink3">{x.label}</p>
              <p className={`num mt-1 font-display text-2xl font-semibold ${x.tone}`}>{x.value}</p>
              <p className="text-[11px] text-ink3">{x.sub}</p>
            </>
          );
          return x.href ? (
            <Link key={x.label} href={x.href} className="panel p-4 transition hover:border-blue/60">
              {body}
            </Link>
          ) : (
            <div key={x.label} className="panel p-4">
              {body}
            </div>
          );
        })}
      </div>
      <Card title="Your plans and results">
        {workflows.length === 0 ? (
          <EmptyState title="Nothing pursued yet" body="Start a plan from Bills & subscriptions or from an opportunity. Results appear here once your transactions confirm them." action={<Link href="/app/bills" className="text-sm text-cyan hover:underline">Open Bills & subscriptions</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-ink3">
                <tr>
                  <th className="py-2 pr-3 font-medium">Plan</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Estimated</th>
                  <th className="py-2 pr-3 font-medium">Confirmed</th>
                  <th className="py-2 font-medium">Not spent so far</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {workflows.map((w) => (
                  <tr key={w.id}>
                    <td className="py-2.5 pr-3">
                      <Link href={`/app/bills/${w.id}`} className="hover:text-cyan">
                        {w.kind === "cancel" ? "Cancel" : "Lower price:"} {w.merchant}
                      </Link>
                      <span className="block text-[11px] text-ink3">{w.actionDate ? `Acted ${shortDate(w.actionDate, { month: "short", day: "numeric", year: "numeric" })}` : "Not acted yet"}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={STAGE_LABEL[w.stage]?.tone ?? "neutral"}>{STAGE_LABEL[w.stage]?.label ?? w.stage}</Badge>
                    </td>
                    <td className="num py-2.5 pr-3 text-ink2">{w.estimatedAnnualCents ? `${money(w.estimatedAnnualCents, w.currency, { noCents: true })}/yr` : "—"}</td>
                    <td className="num py-2.5 pr-3 text-pos">{w.confirmedAnnualCents ? `${money(w.confirmedAnnualCents, w.currency, { noCents: true })}/yr` : "—"}</td>
                    <td className="num py-2.5">{w.realizedCents ? money(w.realizedCents, w.currency) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-ink3">Each recurring charge is counted once, at its furthest stage. &quot;Not spent so far&quot; counts only expected charges that didn&apos;t happen (or the measured price reduction), never projected future savings.</p>
      </Card>
    </div>
  );
}
