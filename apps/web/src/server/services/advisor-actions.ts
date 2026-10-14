/**
 * Changes proposed by the AI advisor. A proposal is validated and described when it is
 * made, stored as PROPOSED, and only takes effect when the user clicks Apply — at which
 * point it is validated again against the user's current data. Every lookup is scoped
 * to the authenticated user; ids supplied by a model are never trusted on their own.
 */
import type { Prisma } from "@prisma/client";
import { advisorChangeSchema, formatMoney, normalizeLayout, setWidgetVisibility, toCents, widgetLabel, type AdvisorChange, MAX_CHANGES_PER_PROPOSAL } from "@veltrix/shared";
import { db } from "../db";
import { cents, decStr } from "../money";
import { HttpError, notFound } from "../errors";
import { todayIn } from "../dates";
import { audit } from "../audit";
import { createAccount, updateAccount } from "./accounts";
import { activeBudgetId, removeBudgetLine, setBudgetLine } from "./budgets";
import { categoryBySlug } from "./categories";
import { addContribution, createGoal, updateGoal } from "./goals";
import { createTransaction } from "./transactions";

export interface ActionCtx {
  timezone: string;
  currency: string;
}

const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_LABEL: Record<string, string> = {
  CHECKING: "checking account",
  SAVINGS: "savings account",
  CREDIT_CARD: "credit card",
  INVESTMENT: "investment account",
  RETIREMENT: "retirement account",
  LOAN: "loan",
  MORTGAGE: "mortgage",
  CASH: "cash",
  PROPERTY: "property",
  OTHER_ASSET: "asset",
  OTHER_LIABILITY: "liability",
};

class ChangeError extends Error {}

/** Check a change against the user's data and describe it in plain language. Throws ChangeError when it can't apply. */
async function describe(userId: string, change: AdvisorChange, ctx: ActionCtx): Promise<string> {
  const m = (amount: string) => formatMoney(toCents(amount), ctx.currency);
  const ym = todayIn(ctx.timezone).slice(0, 7);
  switch (change.action) {
    case "set_monthly_income": {
      const p = await db.userProfile.findUnique({ where: { userId }, select: { monthlyIncome: true } });
      return `Set your monthly take-home income to ${m(change.amount)}${p?.monthlyIncome ? ` (now ${formatMoney(cents(p.monthlyIncome), ctx.currency)})` : ""}`;
    }
    case "update_account_balance": {
      const a = await db.connectedAccount.findFirst({ where: { id: change.accountId, userId, archivedAt: null } });
      if (!a) throw new ChangeError("That account wasn't found.");
      if (a.source === "AGGREGATOR") throw new ChangeError(`${a.name} is linked to your bank, so its balance updates automatically.`);
      return `Update ${a.name} balance to ${formatMoney(toCents(change.balance), a.currency)} (now ${formatMoney(cents(a.currentBalance), a.currency)})`;
    }
    case "create_account":
      return `Add a ${ACCOUNT_LABEL[change.type] ?? "account"} called "${change.name}" with a balance of ${m(change.balance)}`;
    case "set_budget_limit": {
      const cat = (await categoryBySlug(userId)).get(change.category);
      if (!cat) throw new ChangeError("Unknown category.");
      const budgetId = await activeBudgetId(userId, ym);
      const line = budgetId ? await db.budgetCategory.findFirst({ where: { budgetId, categoryId: cat.id } }) : null;
      return `Set your ${cat.name} budget to ${m(change.limit)} a month${line ? ` (now ${formatMoney(cents(line.limitAmount), ctx.currency)})` : budgetId ? " (new budget category)" : " (creates your monthly budget)"}`;
    }
    case "remove_budget_category": {
      const cat = (await categoryBySlug(userId)).get(change.category);
      const budgetId = await activeBudgetId(userId, ym);
      const line = cat && budgetId ? await db.budgetCategory.findFirst({ where: { budgetId, categoryId: cat.id } }) : null;
      if (!line) throw new ChangeError(`${cat?.name ?? "That category"} isn't in your budget.`);
      return `Remove ${cat!.name} from your budget (currently ${formatMoney(cents(line.limitAmount), ctx.currency)})`;
    }
    case "create_goal": {
      const parts = [`Create a goal "${change.name}" to save ${m(change.target)}`];
      if (change.targetDate) parts.push(`by ${change.targetDate}`);
      if (change.plannedMonthly) parts.push(`saving ${m(change.plannedMonthly)} a month`);
      return parts.join(" ");
    }
    case "update_goal": {
      const g = await db.savingsGoal.findFirst({ where: { id: change.goalId, userId, archivedAt: null } });
      if (!g) throw new ChangeError("That goal wasn't found.");
      const parts: string[] = [];
      if (change.target) parts.push(`target ${formatMoney(cents(g.targetAmount), g.currency)} → ${formatMoney(toCents(change.target), g.currency)}`);
      if (change.targetDate !== undefined) parts.push(`date ${change.targetDate ?? "none"}`);
      if (change.plannedMonthly !== undefined) parts.push(`monthly saving ${change.plannedMonthly ? formatMoney(toCents(change.plannedMonthly), g.currency) : "none"}`);
      if (!parts.length) throw new ChangeError("Nothing to change on that goal.");
      return `Update "${g.name}": ${parts.join(", ")}`;
    }
    case "add_goal_contribution": {
      const g = await db.savingsGoal.findFirst({ where: { id: change.goalId, userId, archivedAt: null } });
      if (!g) throw new ChangeError("That goal wasn't found.");
      const c = toCents(change.amount);
      return c > 0 ? `Add ${formatMoney(c, g.currency)} to "${g.name}"` : `Withdraw ${formatMoney(-c, g.currency)} from "${g.name}"`;
    }
    case "add_transaction": {
      if (change.accountId && !(await db.connectedAccount.findFirst({ where: { id: change.accountId, userId } }))) throw new ChangeError("That account wasn't found.");
      const c = toCents(change.amount);
      const cat = change.category ? (await categoryBySlug(userId)).get(change.category) : null;
      return `${c < 0 ? "Record spending" : "Record income"} of ${formatMoney(Math.abs(c), ctx.currency)} — ${change.merchant}${cat ? ` (${cat.name})` : ""} on ${change.date}`;
    }
    case "set_dashboard_widget":
      return change.visible ? `${change.position === "top" ? "Move" : "Show"} "${widgetLabel(change.widget)}" ${change.position === "top" ? "to the top of" : change.position === "bottom" ? "at the bottom of" : "on"} your dashboard` : `Hide "${widgetLabel(change.widget)}" from your dashboard`;
  }
}

async function perform(userId: string, change: AdvisorChange, ctx: ActionCtx) {
  const ym = todayIn(ctx.timezone).slice(0, 7);
  switch (change.action) {
    case "set_monthly_income":
      await db.userProfile.update({ where: { userId }, data: { monthlyIncome: decStr(change.amount) } });
      return;
    case "update_account_balance":
      await updateAccount(userId, change.accountId, { balance: change.balance });
      return;
    case "create_account":
      await createAccount(userId, { name: change.name, type: change.type, balance: change.balance, institution: "", currency: ctx.currency, mask: "" });
      return;
    case "set_budget_limit":
      await setBudgetLine(userId, ym, (await categoryBySlug(userId)).get(change.category)!.id, change.limit);
      return;
    case "remove_budget_category":
      await removeBudgetLine(userId, ym, (await categoryBySlug(userId)).get(change.category)!.id);
      return;
    case "create_goal":
      await createGoal(userId, { name: change.name, kind: change.goalType, target: change.target, startingAmount: "0", targetDate: change.targetDate ?? null, plannedMonthly: change.plannedMonthly ?? null, currency: ctx.currency });
      return;
    case "update_goal":
      await updateGoal(userId, change.goalId, { target: change.target, targetDate: change.targetDate, plannedMonthly: change.plannedMonthly });
      return;
    case "add_goal_contribution":
      await addContribution(userId, change.goalId, { amount: change.amount, date: todayIn(ctx.timezone), note: "Added by the advisor" });
      return;
    case "add_transaction": {
      const cat = change.category ? (await categoryBySlug(userId)).get(change.category) : null;
      await createTransaction(userId, { date: change.date, amount: change.amount, merchant: change.merchant, description: "", notes: "Added by the advisor", categoryId: cat?.id ?? null, accountId: change.accountId ?? null, currency: ctx.currency });
      return;
    }
    case "set_dashboard_widget": {
      const p = await db.userProfile.findUnique({ where: { userId }, select: { dashboardLayout: true } });
      const layout = setWidgetVisibility(normalizeLayout(p?.dashboardLayout), change.widget, change.visible, change.position);
      await db.userProfile.update({ where: { userId }, data: { dashboardLayout: layout } });
      return;
    }
  }
}

export interface ProposalResult {
  proposed: { id: string; summary: string }[];
  rejected: { change: unknown; reason: string }[];
}

/** Validate and store proposed changes for a conversation. Nothing is applied. */
export async function proposeChanges(userId: string, conversationId: string, raw: unknown[], ctx: ActionCtx): Promise<ProposalResult> {
  const result: ProposalResult = { proposed: [], rejected: [] };
  for (const item of raw.slice(0, MAX_CHANGES_PER_PROPOSAL)) {
    const parsed = advisorChangeSchema.safeParse(item);
    if (!parsed.success) {
      result.rejected.push({ change: item, reason: parsed.error.issues.map((i) => `${i.path.join(".") || "change"}: ${i.message}`).join("; ") });
      continue;
    }
    try {
      const summary = await describe(userId, parsed.data, ctx);
      const row = await db.advisorAction.create({
        data: { userId, conversationId, kind: parsed.data.action, payload: parsed.data as Prisma.InputJsonValue, summary, expiresAt: new Date(Date.now() + PROPOSAL_TTL_MS) },
      });
      result.proposed.push({ id: row.id, summary });
    } catch (e) {
      if (!(e instanceof ChangeError)) throw e;
      result.rejected.push({ change: item, reason: e.message });
    }
  }
  if (raw.length > MAX_CHANGES_PER_PROPOSAL) result.rejected.push({ change: null, reason: `Only ${MAX_CHANGES_PER_PROPOSAL} changes can be proposed at once.` });
  return result;
}

export function serializeAction(a: { id: string; kind: string; summary: string; status: string; error: string | null; expiresAt: Date; appliedAt: Date | null }) {
  return { id: a.id, kind: a.kind, summary: a.summary, status: a.status, error: a.error, expired: a.status === "PROPOSED" && a.expiresAt.getTime() < Date.now(), appliedAt: a.appliedAt?.toISOString() ?? null };
}
export type SerializedAction = ReturnType<typeof serializeAction>;

async function getPending(userId: string, id: string) {
  const a = await db.advisorAction.findFirst({ where: { id, userId } });
  if (!a) throw notFound("Proposed change");
  if (a.status !== "PROPOSED") throw new HttpError(409, "already_handled", a.status === "APPLIED" ? "This change was already applied." : "This change was dismissed.");
  if (a.expiresAt.getTime() < Date.now()) throw new HttpError(410, "expired", "This proposal expired. Ask the advisor again.");
  return a;
}

export async function applyAction(userId: string, id: string, ctx: ActionCtx) {
  const a = await getPending(userId, id);
  // Claim the proposal first so a double click can't apply it twice.
  const claimed = await db.advisorAction.updateMany({ where: { id, userId, status: "PROPOSED" }, data: { status: "APPLIED", appliedAt: new Date() } });
  if (claimed.count === 0) throw new HttpError(409, "already_handled", "This change was already handled.");
  const parsed = advisorChangeSchema.safeParse(a.payload);
  try {
    if (!parsed.success) throw new ChangeError("This proposal is no longer valid.");
    await describe(userId, parsed.data, ctx); // re-check against current data
    await perform(userId, parsed.data, ctx);
  } catch (e) {
    const message = e instanceof ChangeError || e instanceof HttpError ? e.message : "Something went wrong applying this change.";
    if (!(e instanceof ChangeError || e instanceof HttpError)) console.error("[advisor] apply failed", e);
    await db.advisorAction.update({ where: { id }, data: { status: "FAILED", error: message, appliedAt: null } });
    throw new HttpError(409, "apply_failed", message);
  }
  await audit("advisor.change_applied", { userId, metadata: { kind: a.kind, summary: a.summary } });
  return serializeAction(await db.advisorAction.findUniqueOrThrow({ where: { id } }));
}

export async function dismissAction(userId: string, id: string) {
  await getPending(userId, id);
  await db.advisorAction.update({ where: { id }, data: { status: "DISMISSED" } });
  return serializeAction(await db.advisorAction.findUniqueOrThrow({ where: { id } }));
}

/** Everything the advisor may reference by id when proposing changes. */
export async function editableItems(userId: string, ctx: ActionCtx) {
  const ym = todayIn(ctx.timezone).slice(0, 7);
  const [accounts, goals, profile, budgetId] = await Promise.all([
    db.connectedAccount.findMany({ where: { userId, archivedAt: null }, orderBy: { name: "asc" } }),
    db.savingsGoal.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: "asc" } }),
    db.userProfile.findUnique({ where: { userId }, select: { monthlyIncome: true, dashboardLayout: true } }),
    activeBudgetId(userId, ym),
  ]);
  const lines = budgetId ? await db.budgetCategory.findMany({ where: { budgetId }, include: { category: true } }) : [];
  return {
    monthlyIncomeCents: profile?.monthlyIncome ? cents(profile.monthlyIncome) : null,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balanceCents: cents(a.currentBalance), currency: a.currency, linkedToBank: a.source === "AGGREGATOR" })),
    goals: goals.map((g) => ({ id: g.id, name: g.name, kind: g.kind, targetCents: cents(g.targetAmount), targetDate: g.targetDate?.toISOString().slice(0, 10) ?? null, plannedMonthlyCents: g.plannedMonthly ? cents(g.plannedMonthly) : null })),
    budget: lines.map((l) => ({ category: l.category.slug, name: l.category.name, limitCents: cents(l.limitAmount) })),
    dashboard: normalizeLayout(profile?.dashboardLayout),
  };
}

