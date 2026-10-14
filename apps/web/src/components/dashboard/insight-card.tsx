"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChartPie, CircleDollarSign, Plane, Repeat, ShieldCheck, ShoppingBag, Sparkles, Target, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export interface InsightView {
  id: string;
  kind: string;
  title: string;
  summary: string;
  rationale: string;
  calculation: string;
  assumptions: string[];
  action: string;
  actionHref: string | null;
  estimateCents: number | null;
  estimateType: "CONFIRMED" | "POTENTIAL" | "NONE";
}

const ICONS: Record<string, LucideIcon> = { subscriptions: Repeat, budget: ChartPie, goal: Target, emergency_fund: ShieldCheck, spending_spike: TrendingUp, idle_cash: Wallet, price: ShoppingBag, trip: Plane, savings_rate: CircleDollarSign };

export function InsightExplain({ insight, open, onClose }: { insight: InsightView; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={insight.title} wide>
      <div className="space-y-4 text-sm">
        <p className="text-ink">{insight.summary}</p>
        {insight.estimateCents !== null && (
          <p className="text-ink2">
            {insight.estimateType === "CONFIRMED" ? "Confirmed amount" : "Potential amount (not guaranteed)"}: <span className="num font-semibold text-ink">{money(insight.estimateCents)}</span>
            {insight.kind === "subscriptions" || insight.kind === "idle_cash" ? " per year" : ""}
          </p>
        )}
        <section>
          <h3 className="mb-1 font-medium text-ink">Why this matters</h3>
          <p className="text-ink2">{insight.rationale}</p>
        </section>
        <section>
          <h3 className="mb-1 font-medium text-ink">How it was calculated</h3>
          <p className="panel-inner num p-3 text-ink2">{insight.calculation}</p>
        </section>
        <section>
          <h3 className="mb-1 font-medium text-ink">Assumptions and limits</h3>
          <ul className="list-disc space-y-1 pl-5 text-ink2">
            {insight.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
        <p className="text-xs text-ink3">Calculated by VELTRIX from your records. Information only — not financial advice.</p>
        {insight.actionHref && (
          <div className="flex justify-end">
            <Link href={insight.actionHref} className="brand-gradient inline-flex h-10 items-center rounded-[10px] px-4 text-sm font-medium text-white">
              {insight.action}
            </Link>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function InsightCard({ insight, compact }: { insight: InsightView; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const router = useRouter();
  const Icon = ICONS[insight.kind] ?? Sparkles;
  if (hidden) return null;
  return (
    <article className="panel-inner flex h-full flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-[10px] bg-gradient-to-br from-blue/25 to-violet/25 text-cyan">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {insight.estimateCents !== null && (
          <Badge tone={insight.estimateType === "CONFIRMED" ? "pos" : "info"} title={insight.estimateType === "CONFIRMED" ? "Confirmed" : "Potential — depends on your actions"}>
            {insight.estimateType === "CONFIRMED" ? "" : "up to "}
            {money(insight.estimateCents, "USD", { noCents: true })}
            {insight.kind === "subscriptions" || insight.kind === "idle_cash" ? "/yr" : ""}
          </Badge>
        )}
      </div>
      <h3 className="text-[13.5px] font-semibold leading-snug text-ink">{insight.title}</h3>
      {!compact && <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink2">{insight.summary}</p>}
      <div className="mt-auto flex items-center gap-1 pt-3">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          How we got this
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            setHidden(true);
            await api(`/api/insights/${insight.id}`, { method: "PATCH", body: { status: "DISMISSED" } }).catch(() => setHidden(false));
            router.refresh();
          }}
          aria-label={`Dismiss: ${insight.title}`}
        >
          Dismiss
        </Button>
      </div>
      <InsightExplain insight={insight} open={open} onClose={() => setOpen(false)} />
    </article>
  );
}

export function AdvisorHighlight({ insight }: { insight: InsightView | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass relative overflow-hidden rounded-[16px] p-4 shadow-[0_0_40px_-12px_rgba(57,217,255,.35)]">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-blue to-violet text-white shadow-[0_0_20px_rgba(121,84,255,.5)]">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-cyan">AI Advisor</p>
          {insight ? (
            <>
              <p className="mt-0.5 text-sm text-ink">{insight.title}</p>
              <button onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-cyan hover:underline">
                View recommendation
              </button>
              <InsightExplain insight={insight} open={open} onClose={() => setOpen(false)} />
            </>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-ink2">No recommendations right now. Ask a question about your money any time.</p>
              <Link href="/app/advisor" className="mt-2 inline-block text-xs font-medium text-cyan hover:underline">
                Open AI Advisor
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
