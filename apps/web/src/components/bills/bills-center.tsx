"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, CircleSlash, HandCoins, Repeat, Scissors, TrendingUp } from "lucide-react";
import { Badge, Button, Card, EmptyState, Spinner, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, shortDate } from "@/lib/format";
import { STAGE_LABEL } from "./stages";

interface Item {
  id: string;
  merchant: string;
  currency: string;
  frequency: string;
  occurrences: number;
  lastObserved: string;
  nextExpected: string | null;
  estimatedAnnualCents: number;
  status: "SUSPECTED" | "CONFIRMED" | "DISMISSED";
  category: { name: string } | null;
  evidence: { date: string; amountCents: number }[];
  latestCents: number;
  priceChange: { previousCents: number; latestCents: number; percent: number } | null;
  workflow: { id: string; kind: string; stage: string; confirmedAnnualCents: number; realizedCents: number } | null;
}
const PER_YEAR: Record<string, number> = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1 };
const FREQ: Record<string, string> = { WEEKLY: "/wk", MONTHLY: "/mo", QUARTERLY: "/qtr", YEARLY: "/yr" };

export function BillsCenter({ items, calendar, currency, start }: { items: Item[]; calendar: { date: string; merchant: string; amountCents: number; currency: string; recurringId: string; detected: boolean }[]; currency: string; start: { recurringId: string; kind: "cancel" | "negotiate" } | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const started = useRef(false);
  const c = currency;
  const active = items.filter((i) => i.status !== "DISMISSED" && i.currency === c);
  const monthly = Math.round(active.reduce((s, i) => s + (i.latestCents * (PER_YEAR[i.frequency] ?? 0)) / 12, 0));

  async function begin(recurringId: string, kind: "cancel" | "negotiate") {
    setBusy(`${recurringId}:${kind}`);
    try {
      const r = await api<{ id: string; existing: boolean }>("/api/workflows", { body: { recurringId, kind } });
      router.push(`/app/bills/${r.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't start the plan", "neg");
      setBusy(null);
    }
  }
  async function keep(id: string) {
    await api(`/api/recurring/${id}`, { method: "PATCH", body: { status: "CONFIRMED" } });
    toast("Marked as a charge you're keeping");
    router.refresh();
  }
  useEffect(() => {
    if (start && !started.current) {
      started.current = true;
      begin(start.recurringId, start.kind);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the deep link
  }, []);

  if (start && busy)
    return (
      <div className="panel grid h-40 place-items-center">
        <span className="flex items-center gap-2 text-sm text-ink2">
          <Spinner className="size-4" /> Preparing your plan…
        </span>
      </div>
    );

  if (!items.length)
    return <EmptyState icon={<Repeat className="size-5" />} title="No recurring charges found yet" body="VELTRIX finds subscriptions and bills after about three months of transactions with the same merchant. Connect a bank or import a CSV to get started." action={<Link href="/app/transactions?import=1" className="text-sm text-cyan hover:underline">Import transactions</Link>} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs text-ink3">Recurring charges</p>
          <p className="num mt-1 font-display text-2xl font-semibold">{money(monthly, c, { noCents: true })}<span className="text-sm font-normal text-ink3">/mo</span></p>
          <p className="text-[11px] text-ink3">{active.length} charges · {money(monthly * 12, c, { noCents: true })} a year at latest prices</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-ink3">Plans in progress</p>
          <p className="num mt-1 font-display text-2xl font-semibold">{items.filter((i) => i.workflow && ["prepared", "approved", "action_taken"].includes(i.workflow.stage)).length}</p>
          <p className="text-[11px] text-ink3">Outcomes are confirmed from your later transactions</p>
        </div>
        <Link href="/app/outcomes" className="panel p-4 transition hover:border-blue/60">
          <p className="text-xs text-ink3">Confirmed results</p>
          <p className="num mt-1 font-display text-2xl font-semibold text-pos">{money(items.reduce((s, i) => s + (i.workflow?.stage === "confirmed" ? i.workflow.confirmedAnnualCents : 0), 0), c, { noCents: true })}<span className="text-sm font-normal text-ink3">/yr</span></p>
          <p className="text-[11px] text-cyan">Open the outcome ledger →</p>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card title="Your recurring charges">
          <ul className="divide-y divide-line-soft">
            {items.map((i) => {
              const max = Math.max(...i.evidence.map((e) => Math.abs(e.amountCents)), 1);
              const wf = i.workflow;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      {i.merchant}
                      {i.status === "SUSPECTED" && <Badge tone="neutral" title="Detected from your transactions; not confirmed by you">Detected</Badge>}
                      {i.priceChange && (
                        <Badge tone="warn" title={`From ${money(i.priceChange.previousCents, i.currency)} to ${money(i.priceChange.latestCents, i.currency)}`}>
                          <TrendingUp className="mr-0.5 inline size-3" aria-hidden />+{i.priceChange.percent}%
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-ink3">
                      {i.category?.name ?? "Uncategorized"} · {i.occurrences} charges · last {shortDate(i.lastObserved)}
                      {i.nextExpected && i.status !== "DISMISSED" ? ` · next ~${shortDate(i.nextExpected)}` : ""}
                    </p>
                  </div>
                  <div className="flex h-8 items-end gap-0.5" role="img" aria-label={`Last ${i.evidence.length} charges: ${i.evidence.map((e) => money(Math.abs(e.amountCents), i.currency)).join(", ")}`}>
                    {i.evidence.map((e) => (
                      <span key={e.date} className="w-2 rounded-sm bg-blue/60" style={{ height: `${Math.max(12, (Math.abs(e.amountCents) / max) * 100)}%` }} title={`${e.date}: ${money(Math.abs(e.amountCents), i.currency)}`} />
                    ))}
                  </div>
                  <div className="w-28 text-right">
                    <p className="num font-medium">{money(i.latestCents, i.currency)}<span className="text-xs text-ink3">{FREQ[i.frequency] ?? ""}</span></p>
                    <p className="num text-[11px] text-ink3">{money(i.latestCents * (PER_YEAR[i.frequency] ?? 0), i.currency, { noCents: true })}/yr</p>
                  </div>
                  <div className="flex w-full flex-wrap justify-end gap-1.5 sm:w-auto">
                    {wf ? (
                      <Link href={`/app/bills/${wf.id}`} className="inline-flex items-center gap-1.5">
                        <Badge tone={STAGE_LABEL[wf.stage]?.tone ?? "neutral"}>{wf.kind === "cancel" ? "Cancel" : "Lower price"}: {STAGE_LABEL[wf.stage]?.label ?? wf.stage}</Badge>
                        <span className="text-xs text-cyan">Open</span>
                      </Link>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" loading={busy === `${i.id}:cancel`} onClick={() => begin(i.id, "cancel")}>
                          <Scissors className="size-3.5" /> Plan to cancel
                        </Button>
                        <Button size="sm" variant="secondary" loading={busy === `${i.id}:negotiate`} onClick={() => begin(i.id, "negotiate")}>
                          <HandCoins className="size-3.5" /> Lower the price
                        </Button>
                        {i.status === "SUSPECTED" && (
                          <Button size="sm" variant="ghost" onClick={() => keep(i.id)} title="Confirm this is a charge you're keeping">
                            <CheckCircle2 className="size-3.5" /> Keep
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink3">
            <CircleSlash className="mt-0.5 size-3 shrink-0" aria-hidden /> VELTRIX can&apos;t contact providers or cancel anything for you. It prepares the steps and a message, and confirms the result from your transactions.
          </p>
        </Card>

        <Card title="Next 60 days">
          {calendar.length === 0 ? (
            <p className="text-sm text-ink3">No charges expected in the next 60 days.</p>
          ) : (
            <ol className="space-y-2">
              {calendar.map((e, n) => (
                <li key={`${e.recurringId}-${e.date}-${n}`} className="flex items-center gap-2 text-sm">
                  <CalendarClock className="size-3.5 shrink-0 text-ink3" aria-hidden />
                  <span className="w-14 shrink-0 text-xs text-ink2">{shortDate(e.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{e.merchant}</span>
                  <span className="num">{money(e.amountCents, e.currency)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-ink3">Expected dates are projected from each charge&apos;s past schedule and can shift by a few days.</p>
        </Card>
      </div>
    </div>
  );
}
