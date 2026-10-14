"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, Info } from "lucide-react";
import type { FinancialProfile } from "@/server/services/twin";
import { Badge, Card } from "@/components/ui";
import { money, shortDate } from "@/lib/format";
import { Explain, FigureTile, type Figure } from "./common";

export function ProfilePanel({ profile: p }: { profile: FinancialProfile }) {
  const c = p.currency;
  const commitmentsTotal = p.commitments.reduce((s, x) => s + x.amountCents, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FigureTile label="Monthly income" figure={p.figures.income as Figure} currency={c} suffix="/mo" emphasis />
        <FigureTile label="Essential spending" figure={p.figures.essential as Figure} currency={c} suffix="/mo" emphasis />
        <FigureTile label="Discretionary spending" figure={p.figures.discretionary as Figure} currency={c} suffix="/mo" emphasis />
        <FigureTile label="Left after spending" figure={p.figures.surplus as Figure} currency={c} suffix="/mo" emphasis />
        <FigureTile label="Available cash" figure={p.figures.liquid as Figure} currency={c} />
        <FigureTile label="Investments" figure={p.figures.investments as Figure} currency={c} emptyText="None added" />
        <FigureTile label="Debt owed" figure={p.figures.debt as Figure} currency={c} emptyText="None added" />
        <div className="panel-inner flex flex-col gap-1.5 p-4">
          <p className="text-xs text-ink3">Reserve coverage</p>
          <p className="num font-display text-xl font-semibold">{p.figures.reserveMonths === null ? <span className="text-ink3">Unknown</span> : `${p.figures.reserveMonths} months`}</p>
          <Badge tone="warn">Calculated</Badge>
          <Explain summary="How is this calculated?">
            Available cash ÷ monthly essential spending. Your target is {p.assumptions.emergencyMonths} months
            {p.figures.essential.cents ? ` (${money(p.figures.essential.cents * p.assumptions.emergencyMonths, c, { noCents: true })})` : ""}.
          </Explain>
        </div>
      </div>

      {p.memory.applied.length > 0 && (
        <div className="panel-inner flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-ink2">
          <span className="font-medium text-ink">Using your saved preferences:</span>
          {p.memory.applied.map((a) => (
            <Badge key={a.id + a.text} tone="violet">{a.text}</Badge>
          ))}
          <Link href="/app/memory" className="ml-auto text-cyan hover:underline">
            Manage memory
          </Link>
        </div>
      )}

      {p.issues.length > 0 && (
        <Card title="What would make this more accurate">
          <ul className="space-y-2">
            {p.issues.map((i, n) => (
              <li key={n} className="flex items-start gap-2.5 text-sm">
                {i.severity === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0 text-ink3" aria-hidden />}
                <span className="flex-1 text-ink2">{i.message}</span>
                {i.href && (
                  <Link href={i.href} className="shrink-0 text-xs text-cyan hover:underline">
                    Fix
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Where your money goes" action={<span className="text-[11px] text-ink3">{p.monthsOfHistory ? `Monthly average, last ${p.monthsOfHistory} full month${p.monthsOfHistory === 1 ? "" : "s"}` : p.budget.length ? "From your budget" : ""}</span>}>
          {p.categories.length === 0 && p.budget.length === 0 ? (
            <p className="text-sm text-ink3">No spending data yet. Connect a bank, import a CSV or set a budget.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(p.categories.length ? p.categories.map((x) => ({ slug: x.slug, name: x.name, cents: x.monthlyCents, essential: x.essential })) : p.budget.map((b) => ({ slug: b.slug, name: b.name, cents: b.limitCents, essential: b.essential }))).map((x) => (
                <li key={x.slug} className="flex items-center gap-2">
                  <span className="flex-1 truncate">{x.name}</span>
                  <Badge tone={x.essential ? "info" : "neutral"}>{x.essential ? "Essential" : "Discretionary"}</Badge>
                  <span className="num w-24 text-right">{money(x.cents, c, { noCents: true })}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-ink3">
            Essential vs discretionary is your choice. <Link href="/app/plan?tab=assumptions" className="text-cyan hover:underline">Change which categories count as essential</Link>.
          </p>
        </Card>
        <Card title="Coming up in the next 30 days" action={commitmentsTotal ? <span className="num text-xs text-ink2">{money(commitmentsTotal, c, { noCents: true })}</span> : null}>
          {p.commitments.length === 0 ? (
            <p className="text-sm text-ink3">No recurring charges are expected in the next 30 days, or none have been detected yet. Recurring charges are found after about three months of transactions.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {p.commitments.map((x) => (
                <li key={x.id} className="flex items-center gap-2">
                  <CalendarClock className="size-4 shrink-0 text-ink3" aria-hidden />
                  <span className="flex-1 truncate">{x.merchant}</span>
                  {!x.confirmed && <Badge tone="neutral">Detected</Badge>}
                  <span className="text-xs text-ink3">{shortDate(x.due)}</span>
                  <span className="num w-20 text-right">{money(x.amountCents, c)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Accounts used for planning">
        <ul className="divide-y divide-line-soft text-sm">
          {p.accounts.length === 0 && <li className="py-2 text-ink3">No accounts yet.</li>}
          {p.accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="flex-1 truncate">{a.name}</span>
              <Badge tone={a.source === "bank" ? "pos" : "violet"}>{a.source === "bank" ? "Bank sync" : "You entered"}</Badge>
              {a.stale && <Badge tone="warn">Out of date</Badge>}
              {!a.included && <Badge tone="neutral">Not used: {a.excludedReason}</Badge>}
              <span className="num w-28 text-right">{money(a.balanceCents, a.currency)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
