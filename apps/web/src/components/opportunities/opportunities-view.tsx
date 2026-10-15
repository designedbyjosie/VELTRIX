"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BellOff,
  CalendarClock,
  ChartPie,
  CheckCircle2,
  CircleDollarSign,

  FileText,
  FlaskConical,
  Landmark,
  LineChart,
  Pin,
  PinOff,
  Plane,
  RefreshCw,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SerializedInsight } from "@/server/services/insights";
import { Badge, Button, EmptyState, Segmented, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, relativeTime, shortDate } from "@/lib/format";
import { Explain } from "@/components/plan/common";

export interface Overview {
  open: SerializedInsight[];
  history: SerializedInsight[];
  muted: { kind: string; label: string }[];
  kinds: { kind: string; label: string }[];
  potentialSavingsCents: number;
  lastRefreshedAt: string | null;
}

const KIND_ICON: Record<string, LucideIcon> = {
  renewal_over_budget: Repeat,
  bill_increase: TrendingUp,
  commitments_vs_cash: CalendarClock,
  trip_vs_goal: Plane,
  price: ShoppingBag,
  research_holding: FileText,
  subscriptions: Repeat,
  budget: ChartPie,
  goal: Target,
  emergency_fund: ShieldCheck,
  spending_spike: TrendingUp,
  idle_cash: Wallet,
  trip: Plane,
  savings_rate: CircleDollarSign,
};
const LINK_ICON: Record<string, LucideIcon> = { recurring: Repeat, budget: ChartPie, goal: Target, product: ShoppingBag, trip: Plane, account: Landmark, instrument: LineChart, article: FileText, plan: FlaskConical };
const CONFIDENCE_TONE = { high: "pos", medium: "info", low: "warn" } as const;
const OUTCOME_LABEL: Record<string, string> = { acted: "I acted on it", already_handled: "Already handled", not_relevant: "Not relevant to me", not_accurate: "The information was wrong" };
const STATUS_LABEL: Record<string, string> = { DONE: "Done", DISMISSED: "Dismissed", RESOLVED: "Resolved on its own" };

function when(eventDate: string | null) {
  if (!eventDate) return null;
  const days = Math.round((Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return null;
  return days === 0 ? "Today" : days === 1 ? "Tomorrow" : days <= 30 ? `In ${days} days` : shortDate(eventDate, { month: "short", day: "numeric", year: "numeric" });
}

export function OpportunitiesView({ initial, currency }: { initial: Overview; currency: string }) {
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<"open" | "following" | "history">("open");
  const [refreshing, setRefreshing] = useState(false);
  const c = currency;
  const following = data.open.filter((o) => o.status === "FOLLOWING");
  const list = tab === "open" ? data.open : tab === "following" ? following : data.history;

  async function reload(refresh = false) {
    if (refresh) setRefreshing(true);
    try {
      setData(await api<Overview>(`/api/opportunities${refresh ? "?refresh=1" : ""}`));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't refresh opportunities", "neg");
    } finally {
      setRefreshing(false);
    }
  }
  async function setStatus(id: string, status: string, outcome?: string) {
    await api(`/api/insights/${id}`, { method: "PATCH", body: { status, outcome: outcome ?? null } });
    await reload();
  }
  async function mute(kind: string, muted: boolean) {
    await api("/api/opportunities/mute", { body: { kind, muted } });
    toast(muted ? "Muted. You can turn it back on below." : "Turned back on.");
    await reload(!muted);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs text-ink3">Open opportunities</p>
          <p className="num mt-1 font-display text-2xl font-semibold">{data.open.length}</p>
          <p className="text-[11px] text-ink3">{following.length} followed</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-ink3">Possible savings</p>
          <p className="num mt-1 font-display text-2xl font-semibold text-cyan">{data.potentialSavingsCents ? `${money(data.potentialSavingsCents, c, { noCents: true })}/yr` : "—"}</p>
          <p className="text-[11px] text-ink3">Not saved yet. Only if you act. Each charge counted once. <Link href="/app/outcomes" className="text-cyan hover:underline">See confirmed results</Link> · <Link href="/app/map" className="text-cyan hover:underline">See the big picture</Link></p>
        </div>
        <div className="panel flex flex-col justify-between p-4">
          <div>
            <p className="text-xs text-ink3">Last checked</p>
            <p className="mt-1 text-sm">{data.lastRefreshedAt ? relativeTime(data.lastRefreshedAt) : "Not yet"}</p>
          </div>
          <Button size="sm" variant="secondary" className="mt-2 self-start" loading={refreshing} onClick={() => reload(true)}>
            <RefreshCw className="size-3.5" /> Check again
          </Button>
        </div>
      </div>

      <Segmented
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          { value: "open", label: `Open (${data.open.length})` },
          { value: "following", label: `Following (${following.length})` },
          { value: "history", label: "History" },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title={tab === "history" ? "No history yet" : tab === "following" ? "You're not following anything" : "Nothing needs your attention"}
          body={tab === "open" ? "VELTRIX connects your bills, budgets, goals, trips, saved products and research, and only surfaces something when it's backed by your data." : tab === "following" ? "Follow an opportunity to keep it at the top while you work on it." : "Opportunities you finish, dismiss, or that resolve on their own appear here for 90 days."}
        />
      ) : (
        <ul className="space-y-3">
          {list.map((o) => (
            <OpportunityCard key={o.id} o={o} currency={c} history={tab === "history"} onStatus={setStatus} onMute={(k) => mute(k, true)} />
          ))}
        </ul>
      )}

      {data.muted.length > 0 && (
        <div className="panel p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <BellOff className="size-4 text-ink3" aria-hidden /> Muted types
          </p>
          <ul className="flex flex-wrap gap-2">
            {data.muted.map((m) => (
              <li key={m.kind}>
                <button onClick={() => mute(m.kind, false)} className="rounded-full border border-line px-3 py-1 text-xs text-ink2 hover:border-blue hover:text-ink" aria-label={`Unmute ${m.label}`}>
                  {m.label} · Unmute
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-ink3">Opportunities are calculated from your VELTRIX data with the rules shown in each one. Ranking uses impact, timing, confidence and how often you&apos;ve dismissed that type, nothing else. Information only, not financial advice.</p>
    </div>
  );
}

function OpportunityCard({ o, currency: c, history, onStatus, onMute }: { o: SerializedInsight; currency: string; history: boolean; onStatus: (id: string, status: string, outcome?: string) => Promise<void>; onMute: (kind: string) => void }) {
  const Icon = KIND_ICON[o.kind] ?? Sparkles;
  const [closing, setClosing] = useState<null | "DONE" | "DISMISSED">(null);
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const soon = when(o.eventDate);
  const impactLabel = useMemo(() => {
    if (o.estimateCents === null) return null;
    const perYear = ["subscriptions", "idle_cash", "bill_increase"].includes(o.kind) ? "/yr" : "";
    return o.estimateType === "POTENTIAL" ? `Possible: ${money(o.estimateCents, c, { noCents: true })}${perYear}` : `${money(o.estimateCents, c, { noCents: true })}${perYear}`;
  }, [o, c]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`panel p-4 ${o.status === "FOLLOWING" ? "border-blue/50" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-blue/25 to-violet/25 text-cyan">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink3">
            <span>{o.kindLabel}</span>
            {o.status === "FOLLOWING" && <Badge tone="info">Following</Badge>}
            {history && <Badge tone="neutral">{STATUS_LABEL[o.status] ?? o.status}</Badge>}
            {history && o.outcome && <span>· {OUTCOME_LABEL[o.outcome] ?? o.outcome}</span>}
          </div>
          <h3 className="mt-0.5 font-medium text-ink">{o.title}</h3>
          <p className="mt-1 text-sm text-ink2">{o.summary}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {impactLabel && <Badge tone={o.estimateType === "POTENTIAL" ? "info" : "neutral"} title={o.estimateType === "POTENTIAL" ? "Only if you act; not money saved" : "A known amount from your records"}>{impactLabel}</Badge>}
            <Badge tone={CONFIDENCE_TONE[o.confidence]} title={o.confidenceBasis}>
              {o.confidence[0].toUpperCase() + o.confidence.slice(1)} confidence
            </Badge>
            {soon && !history && <Badge tone="warn">{soon}</Badge>}
            <span className="text-[11px] text-ink3">Verified {relativeTime(o.generatedAt)}</span>
          </div>

          {o.links.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-label="Connected records">
              <span className="text-[11px] text-ink3">Connects:</span>
              {o.links.map((l) => {
                const LIcon = LINK_ICON[l.type] ?? Sparkles;
                return (
                  <Link key={`${l.type}-${l.id}`} href={l.href} className="inline-flex max-w-[240px] items-center gap-1 rounded-full border border-line-soft bg-bg2 px-2.5 py-1 text-xs text-ink2 hover:border-blue hover:text-ink">
                    <LIcon className="size-3 shrink-0" aria-hidden /> <span className="truncate">{l.name}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="mt-3">
            <Explain summary="Why this, and how it was calculated">
              <div className="space-y-2">
                <p><span className="font-medium text-ink">Why it matters: </span>{o.rationale}</p>
                <p className="num"><span className="font-medium text-ink">Calculation: </span>{o.calculation}</p>
                {o.evidence.length > 0 && (
                  <table className="w-full text-left">
                    <tbody>
                      {o.evidence.map((e, i) => (
                        <tr key={i} className="border-t border-line-soft">
                          <td className="py-1 pr-3 text-ink3">{e.label}</td>
                          <td className="num py-1">{e.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div>
                  <span className="font-medium text-ink">Assumptions and limits:</span>
                  <ul className="mt-0.5 list-disc pl-4">
                    {o.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
                <p><span className="font-medium text-ink">Confidence: </span>{o.confidenceBasis}</p>
                {o.scoreBasis && (
                  <p className="text-ink3">
                    Ranked by: base {o.scoreBasis.base} + impact {o.scoreBasis.impact} + timing {o.scoreBasis.urgency}, × confidence {o.scoreBasis.confidenceFactor}
                    {o.scoreBasis.feedbackFactor < 1 ? ` × ${o.scoreBasis.feedbackFactor} (you've dismissed this type recently)` : ""} = {o.scoreBasis.score}
                  </p>
                )}
                <p className="text-ink3">First noticed {shortDate(o.firstSeenAt, { month: "short", day: "numeric", year: "numeric" })}.</p>
              </div>
            </Explain>
          </div>

          {!history && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {o.actionHref && (
                <Link href={o.actionHref} className="brand-gradient inline-flex h-8 items-center rounded-[10px] px-3 text-xs font-medium text-white">
                  {o.action}
                </Link>
              )}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => onStatus(o.id, o.status === "FOLLOWING" ? "ACTIVE" : "FOLLOWING"))}>
                {o.status === "FOLLOWING" ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />} {o.status === "FOLLOWING" ? "Unfollow" : "Follow"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setClosing(closing === "DONE" ? null : "DONE")}>
                <CheckCircle2 className="size-3.5" /> Done
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setClosing(closing === "DISMISSED" ? null : "DISMISSED")}>
                <X className="size-3.5" /> Dismiss
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onMute(o.kind)} title={`Stop showing "${o.kindLabel}"`}>
                <BellOff className="size-3.5" /> Mute type
              </Button>
            </div>
          )}
          {closing && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] bg-bg2/70 p-2.5">
              <label htmlFor={`out-${o.id}`} className="text-xs text-ink2">
                {closing === "DONE" ? "What happened?" : "Why dismiss it?"}
              </label>
              <Select id={`out-${o.id}`} value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-8 w-56 text-xs">
                <option value="">Choose (optional)</option>
                {(closing === "DONE" ? ["acted", "already_handled"] : ["not_relevant", "not_accurate", "already_handled"]).map((k) => (
                  <option key={k} value={k}>
                    {OUTCOME_LABEL[k]}
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="primary" loading={busy} onClick={() => act(() => onStatus(o.id, closing, outcome || undefined))}>
                Confirm
              </Button>
              {closing === "DISMISSED" && outcome === "not_accurate" && <span className="text-[11px] text-ink3">Tip: correct the underlying record (category, amount or recurring charge) so it isn&apos;t repeated.</span>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
