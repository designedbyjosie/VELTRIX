"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, CheckCircle2, CircleAlert, Clipboard, Clock, ExternalLink, Info, RefreshCw } from "lucide-react";
import type { WorkflowView } from "@/server/services/workflows";
import { Badge, Button, Card, ConfirmButton, Field, FormError, Input, Textarea, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, relativeTime, shortDate } from "@/lib/format";
import { DollarInput, toCents } from "@/components/plan/common";
import { STAGE_LABEL } from "./stages";

const STEPS = ["Discover", "Verify", "Calculate", "Personalize", "Prepare", "Approve", "Act", "Measure", "Learn"] as const;
const FREQ: Record<string, string> = { WEEKLY: "a week", MONTHLY: "a month", QUARTERLY: "a quarter", YEARLY: "a year" };

function currentStep(stage: string) {
  return stage === "prepared" ? 4 : stage === "approved" ? 6 : stage === "action_taken" ? 7 : 8;
}

export function WorkflowPage({ initial, today }: { initial: WorkflowView; today: string }) {
  const toast = useToast();
  const [w, setW] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(w.draft);
  const [contact, setContact] = useState(w.contactUrl ?? "");
  const [target, setTarget] = useState(w.targetCents ? (w.targetCents / 100).toFixed(2) : "");
  const [actDate, setActDate] = useState(today);
  const [newPrice, setNewPrice] = useState("");
  const c = w.currency;
  const step = currentStep(w.stage);
  const open = ["prepared", "approved", "action_taken"].includes(w.stage);
  const verb = w.kind === "cancel" ? "cancel" : "lower";

  async function run(key: string, fn: () => Promise<{ workflow: WorkflowView }>, ok?: string) {
    setBusy(key);
    setError(null);
    try {
      const r = await fn();
      setW(r.workflow);
      if (ok) toast(ok);
    } catch (e) {
      setError(e instanceof ApiError ? (e.fields[0]?.message ?? e.message) : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }
  const patch = (body: unknown, ok?: string) => run("patch", () => api(`/api/workflows/${w.id}`, { method: "PATCH", body }), ok);
  const v = w.verification;

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold">
            {w.kind === "cancel" ? "Cancel" : "Lower the price of"} {w.merchant}
          </h2>
          <Badge tone={STAGE_LABEL[w.stage]?.tone ?? "neutral"}>{STAGE_LABEL[w.stage]?.label ?? w.stage}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink2">
          {money(w.baselineCents, c)} {FREQ[w.frequency]} · {money(w.calculation.yearlyCostCents, c, { noCents: true })} a year
          {w.nextExpected ? ` · next charge expected around ${shortDate(w.nextExpected, { month: "short", day: "numeric" })}` : ""}
        </p>
        <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Workflow steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${i < step || w.stage === "confirmed" ? "border-pos/40 bg-pos/10 text-pos" : i === step ? "border-blue bg-blue/15 text-ink" : "border-line text-ink3"}`}>
              {(i < step || w.stage === "confirmed") && <Check className="size-3" aria-hidden />}
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </div>
      <FormError message={error} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1–2. What VELTRIX found, and how reliable it is">
          <ul className="space-y-1 text-sm">
            {w.evidence.charges.map((e) => (
              <li key={e.date} className="flex justify-between">
                <span className="text-ink2">Charged {shortDate(e.date, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="num">{money(e.amountCents, c)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={w.evidence.confirmedByUser ? "pos" : "neutral"}>{w.evidence.confirmedByUser ? "Confirmed by you" : `Detected from ${w.evidence.occurrences} charges`}</Badge>
            {w.evidence.category && <Badge tone="neutral">{w.evidence.category}</Badge>}
            <Badge tone={w.evidence.dataStale ? "warn" : "info"}>{w.evidence.dataThrough ? `Transactions through ${shortDate(w.evidence.dataThrough, { month: "short", day: "numeric" })}` : "No transaction data"}</Badge>
          </div>
          {w.evidence.dataStale && <p className="mt-2 text-xs text-warn">Your transaction data is more than two weeks old. Sync your bank or import a newer CSV so outcomes can be checked.</p>}
        </Card>

        <Card title="3–4. What it costs you, and what changes">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink2">Yearly cost at the latest price</dt>
              <dd className="num">{money(w.calculation.yearlyCostCents, c)}</dd>
            </div>
            {w.calculation.previousCents !== null && w.calculation.previousCents < w.baselineCents && (
              <div className="flex justify-between">
                <dt className="text-ink2">Recent price change</dt>
                <dd className="num text-warn">{money(w.calculation.previousCents, c)} → {money(w.baselineCents, c)}</dd>
              </div>
            )}
          </dl>
          {w.kind === "negotiate" && open && (
            <div className="mt-3 flex items-end gap-2">
              <Field label="Price you're aiming for (or were offered)" htmlFor="wf-target" className="flex-1">
                <DollarInput id="wf-target" value={target} onChange={setTarget} placeholder={(w.baselineCents / 100).toFixed(2)} />
              </Field>
              <Button size="sm" variant="secondary" loading={busy === "patch"} onClick={() => patch({ targetCents: target.trim() ? toCents(target) : null }, "Estimate updated")}>
                Update
              </Button>
            </div>
          )}
          <p className="mt-3 rounded-[10px] bg-bg2/70 p-2.5 text-xs text-ink2">
            <span className="font-medium text-ink">Estimate, not savings: </span>
            {w.calculation.note}
          </p>
          {w.calculation.planEffect && (
            <div className="mt-2 text-xs text-ink2">
              <p>
                In your plan: about <span className="num text-ink">{money(w.calculation.planEffect.endCashDeltaCents, c, { noCents: true })}</span> more cash over 2 years.
              </p>
              {w.calculation.planEffect.goals
                .filter((g) => (g.monthsSooner ?? 0) > 0 || (g.monthsSooner === null && g.moreSavedCents > 0))
                .map((g) => (
                  <p key={g.name}>
                    &quot;{g.name}&quot;: {g.monthsSooner ? `about ${g.monthsSooner} month${g.monthsSooner === 1 ? "" : "s"} sooner` : `${money(g.moreSavedCents, c, { noCents: true })} more saved`}
                  </p>
                ))}
            </div>
          )}
          {w.personal.priority && (
            <p className="mt-2 rounded-[10px] bg-violet/10 p-2.5 text-xs text-ink2">
              {w.personal.priority === "protect" ? `You told VELTRIX ${w.personal.category} matters to you. Keeping it is a perfectly good choice.` : `You marked ${w.personal.category} as flexible, the first place you'd cut back.`}
            </p>
          )}
        </Card>
      </div>

      <Card title="5. Prepare">
        <div className="grid gap-4 lg:grid-cols-2">
          <ul className="space-y-2">
            {w.checklist.map((i) => (
              <li key={i.id}>
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[#3B82F6]" checked={i.done} disabled={!open} onChange={(e) => patch({ checklist: [{ id: i.id, done: e.target.checked }] })} />
                  <span className={i.done ? "text-ink3 line-through" : ""}>{i.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="space-y-2.5">
            <Field label={w.kind === "cancel" ? "Cancellation message (edit the [BRACKETS])" : "What to say (edit the [BRACKETS])"} htmlFor="wf-draft">
              <Textarea id="wf-draft" rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!open} className="font-mono text-xs" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(draft);
                  toast("Copied");
                }}
              >
                <Clipboard className="size-3.5" /> Copy
              </Button>
              {open && draft !== w.draft && (
                <Button size="sm" variant="ghost" onClick={() => patch({ draft }, "Draft saved")}>
                  Save draft
                </Button>
              )}
            </div>
            <Field label="Official cancellation or contact page (optional)" htmlFor="wf-contact" hint="VELTRIX doesn't supply provider contact details. Use the provider's official site, app or your latest bill.">
              <div className="flex gap-2">
                <Input id="wf-contact" type="url" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="https://" disabled={!open} />
                {open && contact !== (w.contactUrl ?? "") && (
                  <Button size="sm" variant="ghost" onClick={() => patch({ contactUrl: contact.trim() || null }, "Saved")}>
                    Save
                  </Button>
                )}
              </div>
            </Field>
            {w.contactUrl && (
              <a href={w.contactUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-cyan hover:underline">
                Open the page you saved <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="6–7. Approve, then act">
          {w.stage === "prepared" && (
            <div className="space-y-2">
              <p className="text-sm text-ink2">Happy with the plan? Approving it records your decision. You&apos;ll still contact {w.merchant} yourself.</p>
              <Button variant="primary" loading={busy === "approve"} onClick={() => run("approve", () => api(`/api/workflows/${w.id}/approve`, { method: "POST", body: {} }), "Plan approved")}>
                Approve this plan
              </Button>
            </div>
          )}
          {(w.stage === "prepared" || w.stage === "approved") && (
            <form
              className="mt-4 space-y-2.5 border-t border-line-soft pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                const price = newPrice.trim() ? toCents(newPrice) : null;
                if (newPrice.trim() && !price) return setError("Check the new price.");
                run("act", () => api(`/api/workflows/${w.id}/action`, { body: { date: actDate, newPriceCents: price } }), "Recorded. VELTRIX will confirm it from your transactions.");
              }}
            >
              <p className="text-sm font-medium">{w.kind === "cancel" ? "Did you cancel it?" : "Did you get a lower price?"}</p>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="When" htmlFor="wf-date">
                  <Input id="wf-date" type="date" max={today} value={actDate} onChange={(e) => setActDate(e.target.value)} />
                </Field>
                {w.kind === "negotiate" && (
                  <Field label="New price (if you got one)" htmlFor="wf-new">
                    <DollarInput id="wf-new" value={newPrice} onChange={setNewPrice} />
                  </Field>
                )}
              </div>
              <Button type="submit" variant="primary" loading={busy === "act"}>
                {w.kind === "cancel" ? "I've cancelled it" : "I've contacted them"}
              </Button>
              <p className="text-[11px] text-ink3">This records what you did. It isn&apos;t counted as savings until your transactions confirm it.</p>
            </form>
          )}
          {!["prepared", "approved"].includes(w.stage) && (
            <p className="text-sm text-ink2">
              {w.actionDate ? `You reported acting on ${shortDate(w.actionDate, { month: "short", day: "numeric", year: "numeric" })}.` : "No action recorded."}
            </p>
          )}
        </Card>

        <Card
          title="8. Measure"
          action={
            ["action_taken", "not_confirmed"].includes(w.stage) ? (
              <Button size="sm" variant="ghost" loading={busy === "verify"} onClick={() => run("verify", () => api(`/api/workflows/${w.id}/verify`, { method: "POST", body: {} }))}>
                <RefreshCw className="size-3.5" /> Check now
              </Button>
            ) : null
          }
        >
          {!v ? (
            <p className="text-sm text-ink3">After you act, VELTRIX checks your transactions after the next billing date to see whether the charge stopped or dropped.</p>
          ) : (
            <div className={`rounded-[12px] border p-3 text-sm ${v.status === "confirmed" ? "border-pos/40 bg-pos/10" : v.status === "not_confirmed" ? "border-neg/40 bg-neg/10" : "border-warn/40 bg-warn/10"}`} role="status">
              <p className="flex items-center gap-2 font-medium">
                {v.status === "confirmed" ? <CheckCircle2 className="size-4 text-pos" aria-hidden /> : v.status === "not_confirmed" ? <CircleAlert className="size-4 text-neg" aria-hidden /> : <Clock className="size-4 text-warn" aria-hidden />}
                {v.status === "confirmed" ? "Confirmed from your transactions" : v.status === "not_confirmed" ? "Not confirmed" : "Waiting to confirm"}
              </p>
              <p className="mt-1 text-ink2">{v.reason}</p>
              <p className="mt-1 text-[11px] text-ink3">Last checked {relativeTime(v.checkedAt)}</p>
            </div>
          )}
          {w.stage === "not_confirmed" && <p className="mt-2 text-xs text-ink2">If you were charged by mistake, contact {w.merchant} with your confirmation and ask for a refund. Then record the action again if needed.</p>}
        </Card>
      </div>

      <Card title="9. Outcome">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-ink3">Estimated (when planned)</p>
            <p className="num text-lg font-semibold">{w.estimatedAnnualCents ? `${money(w.estimatedAnnualCents, c, { noCents: true })}/yr` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink3">Confirmed ongoing effect</p>
            <p className="num text-lg font-semibold text-pos">{w.confirmedAnnualCents ? `${money(w.confirmedAnnualCents, c, { noCents: true })}/yr` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink3">Actually not spent so far</p>
            <p className="num text-lg font-semibold text-pos">{money(w.realizedCents, c)}</p>
          </div>
        </div>
        <ol className="mt-4 space-y-2 border-t border-line-soft pt-3">
          {w.events.map((e, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="w-24 shrink-0 text-ink3">{shortDate(e.at, { month: "short", day: "numeric" })}</span>
              <span className="text-ink2">{e.note}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-ink3">
            <Info className="size-3" aria-hidden /> Only confirmed outcomes count toward results in the <Link href="/app/outcomes" className="text-cyan hover:underline">outcome ledger</Link>.
          </p>
          {(open || w.stage === "not_confirmed") && (
            <ConfirmButton title={`Stop this plan to ${verb} ${w.merchant}?`} body="Nothing changes with the provider. The plan moves to your history." confirmLabel="Stop plan" onConfirm={async () => run("abandon", () => api(`/api/workflows/${w.id}/abandon`, { body: { reason: "Stopped by you" } }))}>
              Stop this plan
            </ConfirmButton>
          )}
        </div>
      </Card>
    </div>
  );
}
