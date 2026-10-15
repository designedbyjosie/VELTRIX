"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BellOff, Ban, Check, Clock, Database, History, ListChecks, ShieldCheck, X } from "lucide-react";
import { Badge, Button, Card, ConfirmButton, EmptyState, Select, useToast } from "@/components/ui";
import { Toggle } from "@/components/settings/settings-view";
import { STAGE_LABEL } from "@/components/bills/stages";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { EVENT_GROUPS, EVENT_LABELS, type EventGroup } from "@/lib/audit-labels";
import type { PrivacyOverview } from "@/server/services/privacy";

type HistoryItem = { id: string; type: string; createdAt: string; userAgent: string | null; detail: string | null };

const FREQ = [
  { value: "immediate", label: "As they happen" },
  { value: "daily", label: "Daily digest (9:00)" },
  { value: "weekly", label: "Weekly digest (Monday 9:00)" },
  { value: "off", label: "Off" },
] as const;
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${String(h).padStart(2, "0")}:00` }));
const STATUS_TONE = { ok: "pos", attention: "warn", off: "neutral" } as const;
const DELETE_LABEL = { extension_history: "Delete page history", advisor_conversations: "Delete all conversations", notifications: "Clear notifications" } as const;

/** "1 conversations" → "1 conversation". */
function countLabel(count: number, label: string) {
  const l = label.toLowerCase();
  return `${count} ${count === 1 ? l.replace(/s\b/, "") : l}`;
}

function untilText(iso: string) {
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  return h < 1 ? "within the hour" : h < 48 ? `in ${h} hour${h === 1 ? "" : "s"}` : `in ${Math.round(h / 24)} days`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PrivacyView({ overview: o, history: initialHistory, timezone }: { overview: PrivacyOverview; history: { items: HistoryItem[]; nextCursor: string | null }; timezone: string }) {
  const router = useRouter();
  const toast = useToast();
  const [perms, setPerms] = useState(() => Object.fromEntries(o.permissions.map((p) => [p.id, p.enabled])) as Record<string, boolean>);
  const [n, setN] = useState(o.notifications);
  const [history, setHistory] = useState(initialHistory);
  const [group, setGroup] = useState<EventGroup | "">("");
  const [busy, setBusy] = useState<string | null>(null);
  // Keep local state in step with the server after router.refresh().
  useEffect(() => setN(o.notifications), [o.notifications]);
  useEffect(() => setPerms(Object.fromEntries(o.permissions.map((p) => [p.id, p.enabled]))), [o.permissions]);

  const refresh = () => router.refresh();
  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : "Couldn't save that change.", "neg");

  const setPermission = async (p: PrivacyOverview["permissions"][number], v: boolean) => {
    setPerms((s) => ({ ...s, [p.id]: v }));
    try {
      if (p.group === "consent") await api("/api/settings/consent", { body: { purpose: p.id, granted: v } });
      else if (p.group === "memory") await api("/api/memory/settings", { method: "PATCH", body: { enabled: v } });
      else await api("/api/settings/preferences", { method: "PATCH", body: { [p.id]: v } });
      toast(v ? `${p.label}: on` : `${p.label}: off`);
      refresh();
    } catch (e) {
      setPerms((s) => ({ ...s, [p.id]: !v }));
      fail(e);
    }
  };

  const savePrefs = async (patch: Record<string, unknown>, message: string) => {
    try {
      await api("/api/settings/preferences", { method: "PATCH", body: patch });
      toast(message);
      refresh();
    } catch (e) {
      fail(e);
      setN(o.notifications);
    }
  };

  const loadHistory = async (g: EventGroup | "", cursor?: string) => {
    const qs = new URLSearchParams({ ...(g ? { group: g } : {}), ...(cursor ? { cursor } : {}) });
    const r = await api<{ items: HistoryItem[]; nextCursor: string | null }>(`/api/privacy/history?${qs}`);
    setHistory((h) => (cursor ? { items: [...h.items, ...r.items], nextCursor: r.nextCursor } : r));
  };

  const pendingCount = o.pending.proposals.length + o.pending.workflows.filter((w) => w.waitingOn === "you").length;
  const quietOn = n.quietHoursStart !== null && n.quietHoursEnd !== null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label="Waiting for you" value={String(pendingCount)} href="#pending" />
        <Tile label="Data sources" value={String(o.sources.filter((s) => s.status !== "off").length)} href="#sources" />
        <Tile label="Third parties in use" value={String(o.thirdParties.filter((t) => t.active).length)} href="#sources" />
        <Tile label="Notifications" value={n.pausedUntil ? "Paused" : (FREQ.find((f) => f.value === n.frequency)?.label ?? n.frequency)} href="#notifications" />
      </div>

      <Card id="pending" title={<span className="flex items-center gap-2"><ListChecks className="size-4 text-cyan" /> Waiting for your decision</span>}>
        {!o.pending.proposals.length && !o.pending.workflows.length ? (
          <EmptyState title="Nothing is waiting" body="Advisor proposals and savings plans that need you will show up here." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {o.pending.proposals.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{a.summary}</p>
                  <p className="text-xs text-ink3">Advisor proposal · expires {untilText(a.expiresAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy === `apply:${a.id}`}
                    onClick={async () => {
                      setBusy(`apply:${a.id}`);
                      try {
                        await api(`/api/advisor/actions/${a.id}/apply`, { body: {} });
                        toast("Applied");
                        refresh();
                      } catch (e) {
                        fail(e);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <Check className="size-3.5" /> Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === `dismiss:${a.id}`}
                    onClick={async () => {
                      setBusy(`dismiss:${a.id}`);
                      try {
                        await api(`/api/advisor/actions/${a.id}/dismiss`, { body: {} });
                        toast("Dismissed");
                        refresh();
                      } catch (e) {
                        fail(e);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <X className="size-3.5" /> Dismiss
                  </Button>
                </div>
              </li>
            ))}
            {o.pending.workflows.map((w) => {
              const s = STAGE_LABEL[w.stage];
              return (
                <li key={w.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {w.kind === "cancel" ? "Cancel" : "Lower the price of"} {w.merchant}
                    </p>
                    <p className="text-xs text-ink3">
                      Savings plan · {w.waitingOn === "you" ? (w.stage === "prepared" ? "ready for your approval" : "approved; you take the step") : "VELTRIX is waiting for new transactions to confirm it"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={s?.tone ?? "neutral"}>{s?.label ?? w.stage}</Badge>
                    <Link href={`/app/bills/${w.id}`} className="text-sm text-cyan hover:underline">
                      Open
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-cyan" /> What VELTRIX may do</span>}>
          <div className="divide-y divide-line-soft">
            {o.permissions.map((p) => (
              <div key={p.id}>
                <Toggle label={p.label} description={p.description} checked={perms[p.id]} onChange={(v) => setPermission(p, v)} />
                {p.dataAreas && perms[p.id] && (
                  <details className="pb-3 text-xs text-ink2">
                    <summary className="cursor-pointer text-ink3">What the advisor can look up ({p.dataAreas.length} areas)</summary>
                    <ul className="mt-1 list-disc pl-5">
                      {p.dataAreas.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Ban className="size-4 text-cyan" /> What VELTRIX can&apos;t do</span>}>
          <ul className="space-y-3">
            {o.cannotDo.map((c) => (
              <li key={c.label} className="text-sm">
                <p className="font-medium text-ink">{c.label}</p>
                <p className="text-xs text-ink2">{c.basis}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card id="notifications" title={<span className="flex items-center gap-2"><BellOff className="size-4 text-cyan" /> Proactive notifications</span>}>
        <p className="text-xs text-ink2">
          Applies to opportunities, price drops, market alerts and savings outcomes. Account emails (sign-in, password reset) are always sent. Times use your time zone ({timezone}).
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink2">How often</span>
            <Select
              aria-label="How often"
              value={n.frequency}
              onChange={(e) => {
                setN((s) => ({ ...s, frequency: e.target.value }));
                savePrefs({ notifyFrequency: e.target.value }, "Notification frequency saved");
              }}
            >
              {FREQ.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-xs font-medium text-ink2">Quiet hours</span>
            <div className="flex items-center gap-2">
              <Select
                aria-label="Quiet hours start"
                value={quietOn ? String(n.quietHoursStart) : ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  const end = v === null ? null : (n.quietHoursEnd ?? 7);
                  setN((s) => ({ ...s, quietHoursStart: v, quietHoursEnd: end }));
                  savePrefs({ quietHoursStart: v, quietHoursEnd: end }, v === null ? "Quiet hours off" : "Quiet hours saved");
                }}
              >
                <option value="">None</option>
                {HOURS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-ink3">to</span>
              <Select
                aria-label="Quiet hours end"
                disabled={!quietOn}
                value={quietOn ? String(n.quietHoursEnd) : ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setN((s) => ({ ...s, quietHoursEnd: v }));
                  savePrefs({ quietHoursStart: n.quietHoursStart, quietHoursEnd: v }, "Quiet hours saved");
                }}
              >
                {!quietOn && <option value="">–</option>}
                {HOURS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="text-sm">
            <span className="mb-1 block text-xs font-medium text-ink2">Pause</span>
            {n.pausedUntil ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">Paused until {fmtDate(n.pausedUntil)}</Badge>
                <Button size="sm" variant="ghost" onClick={() => savePrefs({ notificationsPausedUntil: null }, "Notifications resumed")}>
                  Resume now
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "1 day", days: 1 },
                  { label: "1 week", days: 7 },
                  { label: "30 days", days: 30 },
                ].map((p) => (
                  <Button key={p.days} size="sm" variant="secondary" onClick={() => savePrefs({ notificationsPausedUntil: new Date(Date.now() + p.days * 86_400_000).toISOString() }, `Paused for ${p.label}`)}>
                    {p.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-ink3">
          While paused or off, notifications aren&apos;t created; anything still true afterwards appears on the next check. Quiet hours and digests hold notifications until their time.
          {n.mutedOpportunityKinds.length > 0 && (
            <>
              {" "}
              {n.mutedOpportunityKinds.length} opportunity type{n.mutedOpportunityKinds.length === 1 ? " is" : "s are"} muted on{" "}
              <Link href="/app/opportunities" className="text-cyan hover:underline">
                Opportunities
              </Link>
              .
            </>
          )}
        </p>
        {o.notifications.held.length > 0 && (
          <div className="panel-inner mt-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink2">
                <Clock className="size-3.5" /> {o.notifications.held.length} held
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api("/api/privacy/release", { body: {} }).catch(fail);
                  toast("Held notifications are now in your inbox");
                  refresh();
                }}
              >
                Show them now
              </Button>
            </div>
            <ul className="mt-1 space-y-1 text-xs">
              {o.notifications.held.slice(0, 8).map((h) => (
                <li key={h.id} className="flex justify-between gap-3">
                  <span className="truncate text-ink">{h.title}</span>
                  <span className="shrink-0 text-ink3">{fmtDate(h.deliverAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card id="sources" title={<span className="flex items-center gap-2"><Database className="size-4 text-cyan" /> Your data, by source</span>}>
        <ul className="divide-y divide-line-soft">
          {o.sources.map((s) => (
            <li key={s.id} className="grid gap-2 py-3 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {s.name} <Badge tone={STATUS_TONE[s.status]}>{s.statusText}</Badge>
                </p>
                <p className="mt-0.5 text-xs text-ink2">
                  {s.records.map((r) => countLabel(r.count, r.label)).join(" · ")}
                  {s.lastUpdated ? ` · last activity ${relativeTime(s.lastUpdated)}` : ""}
                </p>
                <p className="mt-1 text-xs text-ink2">
                  <span className="text-ink3">Used for:</span> {s.usedFor}
                </p>
                <p className="text-xs text-ink2">
                  <span className="text-ink3">Shared with:</span> {s.sharedWith}
                </p>
                <p className="text-xs text-ink3">{s.deletion}</p>
              </div>
              <div className="flex items-start gap-2 md:flex-col md:items-end">
                <Link href={s.manage.href} className="text-sm text-cyan hover:underline">
                  {s.manage.label}
                </Link>
                {"deletable" in s && s.deletable && (
                  <ConfirmButton
                    title={`${DELETE_LABEL[s.deletable]}?`}
                    body="This can't be undone. Other data isn't affected."
                    onConfirm={async () => {
                      try {
                        const r = await api<{ deleted: number }>("/api/privacy/delete", { body: { source: s.deletable } });
                        toast(`Deleted ${r.deleted}`);
                        refresh();
                      } catch (e) {
                        fail(e);
                      }
                    }}
                  >
                    {DELETE_LABEL[s.deletable]}
                  </ConfirmButton>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-medium text-ink3">Outside services</p>
        <ul className="mt-1 grid gap-2 md:grid-cols-2">
          {o.thirdParties.map((t) => (
            <li key={t.name} className="panel-inner p-3 text-xs">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                {t.name} <Badge tone={t.active ? "info" : "neutral"}>{t.active ? "In use" : t.configured ? "Configured, not in use" : "Not configured"}</Badge>
              </p>
              <p className="mt-0.5 text-ink2">{t.receives}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink3">
          Want everything? Export or delete your whole account in{" "}
          <Link href="/app/settings#data" className="text-cyan hover:underline">
            Settings → Your data
          </Link>
          .
        </p>
      </Card>

      <Card
        id="history"
        title={<span className="flex items-center gap-2"><History className="size-4 text-cyan" /> Activity history</span>}
        action={
          <Select
            aria-label="Filter activity"
            className="w-auto"
            value={group}
            onChange={(e) => {
              const g = e.target.value as EventGroup | "";
              setGroup(g);
              loadHistory(g).catch(fail);
            }}
          >
            <option value="">Everything</option>
            {Object.entries(EVENT_GROUPS).map(([k, g]) => (
              <option key={k} value={k}>
                {g.label}
              </option>
            ))}
          </Select>
        }
      >
        {!history.items.length ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="divide-y divide-line-soft">
            {history.items.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{EVENT_LABELS[e.type] ?? e.type}</span>
                  {e.detail && <span className="block truncate text-xs text-ink3">{e.detail}</span>}
                </span>
                <span className="shrink-0 text-xs text-ink3" title={new Date(e.createdAt).toLocaleString()}>
                  {relativeTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {history.nextCursor && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => loadHistory(group, history.nextCursor!).catch(fail)}>
            Show more
          </Button>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a href={href} className="panel block p-4 transition hover:border-cyan/40">
      <p className="text-xs text-ink3">{label}</p>
      <p className="mt-1 truncate font-display text-xl font-semibold text-ink">{value}</p>
    </a>
  );
}
