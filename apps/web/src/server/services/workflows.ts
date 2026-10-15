/**
 * Opportunity-to-outcome workflows. The first supported workflow acts on a recurring
 * charge (cancel it, or negotiate / downgrade it):
 *
 *   Discover  — the charge is detected from the user's transactions (recurring service)
 *   Verify    — evidence: past charges, how fresh the data is, whether the user confirmed it
 *   Calculate — yearly cost, recent price change, and the effect on the user's plan
 *   Personalize — saved priorities (financial memory) are shown, never used to judge
 *   Prepare   — checklist and a message draft with clearly marked placeholders
 *   Approve   — the user chooses to go ahead with the plan
 *   Act       — the USER contacts the provider; VELTRIX can't and never claims to
 *   Measure   — later transactions confirm (or don't) that the charge stopped or dropped
 *   Learn     — confirmed outcomes close related opportunities and feed the outcome ledger
 */
import type { Prisma } from "@prisma/client";
import { comparePlans, formatMoney, ledgerTotals, merchantKey, sameMerchant, simulatePlan, verifyRecurringOutcome, type Frequency, type LedgerEntry } from "@veltrix/shared";
import { db } from "../db";
import { cents } from "../money";
import { addDays, fromYmd, todayIn, ymd } from "../dates";
import { badRequest, HttpError, notFound } from "../errors";
import { audit } from "../audit";
import { notify } from "./notifications";
import { listRecurring } from "./recurring";
import { buildProfile } from "./twin";

export type WorkflowKind = "cancel" | "negotiate";
export type WorkflowStage = "prepared" | "approved" | "action_taken" | "confirmed" | "not_confirmed" | "abandoned";
const OPEN_STAGES: WorkflowStage[] = ["prepared", "approved", "action_taken"];
const PER_YEAR: Record<string, number> = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1 };

interface Ctx {
  timezone: string;
  currency: string;
}
interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}
interface WorkflowEvent {
  at: string;
  stage: string;
  note: string;
}

function checklistFor(kind: WorkflowKind, merchant: string, due: string | null): ChecklistItem[] {
  const before = due ? ` before ${due}` : "";
  return kind === "cancel"
    ? [
        { id: "terms", label: `Check your ${merchant} agreement for a cancellation fee, notice period or minimum term`, done: false },
        { id: "contact", label: `Cancel${before} through ${merchant}'s official website or app, or the contact on your latest bill`, done: false },
        { id: "confirm", label: "Save the cancellation confirmation (email or screenshot) with the date", done: false },
        { id: "equipment", label: "Return any equipment or download anything you want to keep, if it applies", done: false },
        { id: "watch", label: "Watch for a final or unexpected charge; VELTRIX checks your transactions after the next billing date", done: false },
      ]
    : [
        { id: "current", label: `Note your current ${merchant} plan, price and what you actually use`, done: false },
        { id: "compare", label: "Find a comparable alternative and its total price (fees, contract length, promos that expire)", done: false },
        { id: "contact", label: `Contact ${merchant} through its official channel and ask for a lower rate or cheaper plan`, done: false },
        { id: "writing", label: "Get the new price, start date and any new contract terms in writing", done: false },
        { id: "watch", label: "Check the next bill; VELTRIX compares the next charge with what you paid before", done: false },
      ];
}

function draftFor(kind: WorkflowKind, merchant: string, amount: string, previous: string | null, due: string | null, frequencyLabel: string, target: string | null): string {
  if (kind === "cancel") {
    return [
      `Subject: Cancellation request`,
      ``,
      `Hello ${merchant} team,`,
      ``,
      `Please cancel my subscription for the account under [YOUR NAME / ACCOUNT EMAIL]${due ? `, effective before my next billing date (${due})` : ""}.`,
      `Please confirm in writing that the cancellation is complete, the date of any final charge, and that no further charges will be made.`,
      ``,
      `Thank you,`,
      `[YOUR NAME]`,
    ].join("\n");
  }
  return [
    `Hello, I'm calling about my ${merchant} account under [YOUR NAME / ACCOUNT EMAIL].`,
    ``,
    `I currently pay ${amount} ${frequencyLabel}${previous ? `, up from ${previous} recently` : ""}.`,
    `I'd like to keep the service if the price works for me. Are there any current promotions, loyalty discounts or a lower-cost plan that would fit how I use it?`,
    target ? `I'm hoping to bring it to about ${target}.` : `[OPTIONAL: I've found comparable service from [PROVIDER] for [PRICE YOU VERIFIED].]`,
    `If we can't find a better price, I'm considering cancelling.`,
    ``,
    `If you can lower it, please confirm the new price, when it starts, and whether it changes my contract in writing.`,
  ].join("\n");
}

const event = (stage: string, note: string): WorkflowEvent => ({ at: new Date().toISOString(), stage, note });

async function owned(userId: string, id: string) {
  const w = await db.opportunityWorkflow.findFirst({ where: { id, userId } });
  if (!w) throw notFound("Workflow");
  return w;
}

/** Start (or return the open) workflow for a recurring charge. */
export async function prepareWorkflow(userId: string, recurringId: string, kind: WorkflowKind) {
  const rec = (await listRecurring(userId)).find((r) => r.id === recurringId);
  if (!rec) throw notFound("Recurring charge");
  if (rec.frequency === "UNKNOWN" || !PER_YEAR[rec.frequency]) throw badRequest("This charge doesn't have a regular schedule yet.");
  const existing = await db.opportunityWorkflow.findFirst({ where: { userId, recurringId, stage: { in: OPEN_STAGES } } });
  if (existing) return { id: existing.id, existing: true };

  const latest = Math.abs(rec.evidence[rec.evidence.length - 1]?.amountCents ?? rec.amountCents);
  const previous = rec.evidence.length >= 2 ? Math.abs(rec.evidence[rec.evidence.length - 2].amountCents) : null;
  const fmt = (c: number) => formatMoney(c, rec.currency);
  const freqLabel = { WEEKLY: "a week", MONTHLY: "a month", QUARTERLY: "a quarter", YEARLY: "a year" }[rec.frequency as Frequency];
  const w = await db.opportunityWorkflow.create({
    data: {
      userId,
      recurringId,
      kind,
      merchant: rec.merchant,
      merchantKey: merchantKey(rec.merchant),
      frequency: rec.frequency,
      currency: rec.currency,
      baselineCents: latest,
      nextExpected: rec.nextExpected ? fromYmd(rec.nextExpected) : null,
      // Cancelling avoids the whole charge; a negotiation's size isn't known, so it's estimated as zero until the user enters a target.
      estimatedAnnualCents: kind === "cancel" ? latest * PER_YEAR[rec.frequency] : 0,
      checklist: checklistFor(kind, rec.merchant, rec.nextExpected) as unknown as Prisma.InputJsonValue,
      draft: draftFor(kind, rec.merchant, fmt(latest), previous && previous < latest ? fmt(previous) : null, rec.nextExpected, freqLabel, null),
      events: [event("prepared", `Plan prepared to ${kind === "cancel" ? "cancel" : "lower"} ${rec.merchant} (${fmt(latest)} ${freqLabel}).`)] as unknown as Prisma.InputJsonValue,
    },
  });
  await audit("workflow.started", { userId, metadata: { kind, merchant: rec.merchant } });
  return { id: w.id, existing: false };
}

/** Everything the workflow page shows, step by step. */
export async function getWorkflow(userId: string, id: string, ctx: Ctx) {
  const w = await owned(userId, id);
  const rec = w.recurringId ? (await listRecurring(userId)).find((r) => r.id === w.recurringId) ?? null : null;
  const fmt = (c: number) => formatMoney(c, w.currency);
  const today = todayIn(ctx.timezone);
  const [dataThrough, profile] = await Promise.all([dataCoverage(userId), buildProfile(userId, ctx)]);

  // Calculate: what changes in the user's plan if this charge stops (or drops to the target).
  const monthly = Math.round((w.baselineCents * PER_YEAR[w.frequency]) / 12);
  const monthlyEffect = w.kind === "cancel" ? monthly : w.targetCents !== null ? Math.round(((w.baselineCents - w.targetCents) * PER_YEAR[w.frequency]) / 12) : 0;
  let planEffect: { goals: { name: string; monthsSooner: number | null; moreSavedCents: number }[]; endCashDeltaCents: number } | null = null;
  if (profile.canProject && monthlyEffect > 0) {
    const essential = rec?.category?.slug && profile.settings.essentialCategories.includes(rec.category.slug);
    const base = simulatePlan(profile.baseline, [], 24, profile.assumptions).summary;
    const alt = simulatePlan(profile.baseline, [{ kind: "expense", label: w.merchant, bucket: essential ? "essential" : "discretionary", amountCents: -monthlyEffect, startMonth: 0, months: null }], 24, profile.assumptions).summary;
    const cmp = comparePlans(base, alt);
    planEffect = { endCashDeltaCents: cmp.endLiquidDeltaCents, goals: cmp.goalDelays.map((g) => ({ name: g.name, monthsSooner: g.delayMonths === null ? null : -g.delayMonths, moreSavedCents: g.endSavedDeltaCents })) };
  }
  const priority = profile.memory.preferences.protect.find((p) => p.category === rec?.category?.slug) ? "protect" : profile.memory.preferences.flexible.find((p) => p.category === rec?.category?.slug) ? "flexible" : null;

  return {
    id: w.id,
    kind: w.kind as WorkflowKind,
    stage: w.stage as WorkflowStage,
    merchant: w.merchant,
    currency: w.currency,
    frequency: w.frequency,
    baselineCents: w.baselineCents,
    estimatedAnnualCents: w.estimatedAnnualCents,
    targetCents: w.targetCents,
    nextExpected: w.nextExpected ? ymd(w.nextExpected) : null,
    checklist: w.checklist as unknown as ChecklistItem[],
    draft: w.draft,
    contactUrl: w.contactUrl,
    notes: w.notes,
    actionDate: w.actionDate ? ymd(w.actionDate) : null,
    verification: w.verification as { status: string; reason: string; checkAfter: string | null; checkedAt: string } | null,
    realizedCents: w.realizedCents,
    confirmedAnnualCents: w.confirmedAnnualCents,
    events: (w.events as unknown as WorkflowEvent[]) ?? [],
    createdAt: w.createdAt.toISOString(),
    evidence: {
      charges: rec?.evidence.map((e) => ({ date: e.date, amountCents: Math.abs(e.amountCents) })) ?? [],
      occurrences: rec?.occurrences ?? 0,
      confirmedByUser: rec?.status === "CONFIRMED",
      category: rec?.category?.name ?? null,
      dataThrough,
      dataStale: dataThrough !== null && dataThrough < addDays(today, -14),
    },
    calculation: {
      yearlyCostCents: w.baselineCents * PER_YEAR[w.frequency],
      monthlyEquivalentCents: monthly,
      previousCents: rec && rec.evidence.length >= 2 ? Math.abs(rec.evidence[rec.evidence.length - 2].amountCents) : null,
      monthlyEffectCents: monthlyEffect,
      planEffect,
      note: w.kind === "cancel" ? `Cancelling would avoid about ${fmt(w.baselineCents * PER_YEAR[w.frequency])} a year if nothing replaces it.` : w.targetCents !== null ? `At ${fmt(w.targetCents)} you'd pay about ${fmt((w.baselineCents - w.targetCents) * PER_YEAR[w.frequency])} less a year.` : "Enter the price you're aiming for (or were offered) to estimate the difference. VELTRIX doesn't have verified prices for this provider.",
    },
    personal: { priority, category: rec?.category?.name ?? null },
  };
}
export type WorkflowView = Awaited<ReturnType<typeof getWorkflow>>;

/** Latest date the user's transaction data covers: newest transaction or bank sync. */
async function dataCoverage(userId: string): Promise<string | null> {
  const [t, item] = await Promise.all([
    db.transaction.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { date: true } }),
    db.plaidItem.findFirst({ where: { userId, status: "ok" }, orderBy: { lastSyncedAt: "desc" }, select: { lastSyncedAt: true } }),
  ]);
  const dates = [t ? ymd(t.date) : null, item?.lastSyncedAt ? item.lastSyncedAt.toISOString().slice(0, 10) : null].filter((d): d is string => !!d);
  return dates.sort().pop() ?? null;
}

export async function updateWorkflow(userId: string, id: string, patch: { checklist?: { id: string; done: boolean }[]; targetCents?: number | null; contactUrl?: string | null; notes?: string; draft?: string }) {
  const w = await owned(userId, id);
  if (!OPEN_STAGES.includes(w.stage as WorkflowStage)) throw new HttpError(409, "closed", "This workflow is finished.");
  const items = (w.checklist as unknown as ChecklistItem[]).map((i) => ({ ...i, done: patch.checklist?.find((p) => p.id === i.id)?.done ?? i.done }));
  const target = patch.targetCents === undefined ? w.targetCents : patch.targetCents;
  if (target !== null && target !== undefined && target >= w.baselineCents) throw badRequest("The target price should be lower than what you pay now.");
  await db.opportunityWorkflow.update({
    where: { id },
    data: {
      checklist: items as unknown as Prisma.InputJsonValue,
      ...(patch.targetCents !== undefined ? { targetCents: patch.targetCents, estimatedAnnualCents: patch.targetCents === null ? 0 : (w.baselineCents - patch.targetCents) * PER_YEAR[w.frequency] } : {}),
      ...(patch.contactUrl !== undefined ? { contactUrl: patch.contactUrl } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.draft !== undefined ? { draft: patch.draft } : {}),
    },
  });
}

async function advance(userId: string, id: string, from: WorkflowStage[], to: WorkflowStage, note: string, data: Prisma.OpportunityWorkflowUpdateInput = {}) {
  const w = await owned(userId, id);
  if (!from.includes(w.stage as WorkflowStage)) throw new HttpError(409, "wrong_stage", `This step isn't available while the workflow is "${w.stage.replace("_", " ")}".`);
  // Guard against double-submits: only advance if the stage hasn't changed meanwhile.
  const r = await db.opportunityWorkflow.updateMany({ where: { id, userId, stage: w.stage }, data: { ...(data as Prisma.OpportunityWorkflowUpdateManyMutationInput), stage: to, events: [...((w.events as unknown as WorkflowEvent[]) ?? []), event(to, note)] as unknown as Prisma.InputJsonValue } });
  if (!r.count) throw new HttpError(409, "conflict", "This workflow changed. Reload and try again.");
  return w;
}

export async function approveWorkflow(userId: string, id: string) {
  await advance(userId, id, ["prepared"], "approved", "You approved the plan. Next: contact the provider yourself; VELTRIX can't contact them for you.");
}

export async function recordAction(userId: string, id: string, input: { date: string; newPriceCents?: number | null; note?: string }, ctx: Ctx) {
  const today = todayIn(ctx.timezone);
  if (input.date > today) throw badRequest("The date can't be in the future.");
  const w = await owned(userId, id);
  if (w.kind === "negotiate" && input.newPriceCents != null && input.newPriceCents >= w.baselineCents) throw badRequest("The new price should be lower than before.");
  const what = w.kind === "cancel" ? "cancelled" : input.newPriceCents != null ? `negotiated to ${formatMoney(input.newPriceCents, w.currency)} (not yet confirmed)` : "contacted the provider";
  await advance(userId, id, ["prepared", "approved"], "action_taken", `You reported you ${what} on ${input.date}.${input.note ? ` Note: ${input.note.slice(0, 200)}` : ""} VELTRIX will check your transactions to confirm.`, {
    actionDate: fromYmd(input.date),
    ...(w.kind === "negotiate" && input.newPriceCents != null ? { targetCents: input.newPriceCents, estimatedAnnualCents: (w.baselineCents - input.newPriceCents) * PER_YEAR[w.frequency] } : {}),
  });
  await audit("workflow.action_reported", { userId, metadata: { kind: w.kind, merchant: w.merchant } });
  return verifyWorkflow(userId, id, ctx);
}

export async function abandonWorkflow(userId: string, id: string, reason?: string) {
  await advance(userId, id, ["prepared", "approved", "action_taken", "not_confirmed"], "abandoned", reason ? `Stopped: ${reason.slice(0, 200)}` : "You stopped this workflow.");
}

/** Measure: check the user's later transactions for this merchant. Idempotent. */
export async function verifyWorkflow(userId: string, id: string, ctx: Ctx) {
  const w = await owned(userId, id);
  if (!["action_taken", "not_confirmed"].includes(w.stage) || !w.actionDate) return getWorkflow(userId, id, ctx);
  const today = todayIn(ctx.timezone);
  const actionDate = ymd(w.actionDate);
  const rows = await db.transaction.findMany({ where: { userId, amount: { lt: 0 }, date: { gte: w.actionDate } }, select: { date: true, merchant: true, amount: true } });
  const chargesAfter = rows.filter((r) => merchantKey(r.merchant) === w.merchantKey || sameMerchant(r.merchant, w.merchant)).map((r) => ({ date: ymd(r.date), amountCents: -cents(r.amount) }));
  const result = verifyRecurringOutcome({
    kind: w.kind as WorkflowKind,
    frequency: w.frequency as Frequency,
    baselineCents: w.baselineCents,
    actionDate,
    nextExpected: w.nextExpected ? ymd(w.nextExpected) : actionDate,
    chargesAfter,
    dataThrough: await dataCoverage(userId),
    today,
  });
  const stage: WorkflowStage = result.status === "confirmed" ? "confirmed" : result.status === "not_confirmed" ? "not_confirmed" : "action_taken";
  const events = (w.events as unknown as WorkflowEvent[]) ?? [];
  const changed = stage !== w.stage;
  await db.opportunityWorkflow.update({
    where: { id },
    data: {
      stage,
      verification: { status: result.status, reason: result.reason, checkAfter: result.checkAfter, checkedAt: new Date().toISOString() },
      verifiedAt: result.status === "confirmed" ? (w.verifiedAt ?? new Date()) : null,
      realizedCents: result.realizedCents,
      confirmedAnnualCents: result.confirmedAnnualCents,
      ...(changed ? { events: [...events, event(stage, result.reason)] as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  if (changed && stage === "confirmed") {
    // Learn: the related opportunities are handled, and the charge is no longer expected.
    if (w.recurringId) {
      if (w.kind === "cancel") await db.recurringPayment.update({ where: { id: w.recurringId }, data: { status: "DISMISSED", nextExpectedAt: null } });
      await db.financialInsight.updateMany({ where: { userId, status: { in: ["ACTIVE", "FOLLOWING"] }, dedupeKey: { contains: w.recurringId } }, data: { status: "DONE", outcome: "acted", outcomeAt: new Date() } });
    }
    await notify(userId, { kind: "outcome", dedupeKey: `outcome:${id}:confirmed`, title: `Confirmed: ${w.merchant} ${w.kind === "cancel" ? "stopped charging" : "is charging less"}`, body: result.reason, link: `/app/bills/${id}` });
    await audit("workflow.outcome_confirmed", { userId, metadata: { kind: w.kind, merchant: w.merchant, confirmedAnnualCents: result.confirmedAnnualCents } });
  }
  if (changed && stage === "not_confirmed") {
    await notify(userId, { kind: "outcome", dedupeKey: `outcome:${id}:not_confirmed`, title: `${w.merchant}: change not confirmed`, body: result.reason, link: `/app/bills/${id}` });
  }
  return getWorkflow(userId, id, ctx);
}

/** Re-check every workflow waiting on an outcome (run by the scheduled job and on page load). */
export async function verifyPendingWorkflows(userId: string, ctx: Ctx) {
  const open = await db.opportunityWorkflow.findMany({ where: { userId, stage: { in: ["action_taken", "not_confirmed"] } }, select: { id: true } });
  for (const w of open) await verifyWorkflow(userId, w.id, ctx);
  return open.length;
}

export async function listWorkflows(userId: string) {
  const rows = await db.opportunityWorkflow.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  return rows.map((w) => ({
    id: w.id,
    recurringId: w.recurringId,
    kind: w.kind as WorkflowKind,
    stage: w.stage as WorkflowStage,
    merchant: w.merchant,
    currency: w.currency,
    baselineCents: w.baselineCents,
    estimatedAnnualCents: w.estimatedAnnualCents,
    confirmedAnnualCents: w.confirmedAnnualCents,
    realizedCents: w.realizedCents,
    actionDate: w.actionDate ? ymd(w.actionDate) : null,
    verification: w.verification as { status: string; reason: string; checkAfter: string | null } | null,
    updatedAt: w.updatedAt.toISOString(),
  }));
}

/**
 * Outcome ledger. Buckets never mix: possible savings identified by opportunities,
 * planned and initiated workflows (estimates), confirmed outcomes, and realized money.
 * Each recurring charge counts once, at its furthest stage.
 */
export async function outcomeLedger(userId: string) {
  const [workflows, insights] = await Promise.all([listWorkflows(userId), db.financialInsight.findMany({ where: { userId, status: { in: ["ACTIVE", "FOLLOWING"] }, estimateType: "POTENTIAL" }, select: { evidence: true, title: true } })]);
  const entries: LedgerEntry[] = [];
  for (const i of insights) {
    const parts = (i.evidence as { savingsParts?: { key: string; cents: number }[] } | null)?.savingsParts ?? [];
    for (const p of parts) entries.push({ key: p.key, stage: "identified", estimatedAnnualCents: p.cents, confirmedAnnualCents: 0, realizedCents: 0 });
  }
  const stageMap: Record<WorkflowStage, LedgerEntry["stage"]> = { prepared: "planned", approved: "planned", action_taken: "initiated", confirmed: "confirmed", not_confirmed: "not_confirmed", abandoned: "abandoned" };
  for (const w of workflows) {
    entries.push({ key: w.recurringId ? `rec:${w.recurringId}` : `wf:${w.id}`, stage: stageMap[w.stage], estimatedAnnualCents: w.estimatedAnnualCents, confirmedAnnualCents: w.confirmedAnnualCents, realizedCents: w.realizedCents });
  }
  return { totals: ledgerTotals(entries), workflows };
}
