/**
 * Financial memory: preferences and goals the user deliberately saves so the advisor and
 * plans can use them across sessions. Nothing here is inferred. Every item is visible,
 * editable, can be switched off individually, and the whole feature has a master switch.
 * Only enabled items reach the advisor or the plan engine, and only for their owner.
 */
import type { Prisma } from "@prisma/client";
import { formatMoney, memoryValueSchema, type MemoryValue } from "@veltrix/shared";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { audit } from "../audit";

export const MAX_MEMORY_ITEMS = 50;

const CATEGORY_NAME: Record<string, string> = {
  housing: "Housing",
  utilities: "Utilities",
  food: "Food & dining",
  transport: "Transportation",
  health: "Health",
  subscriptions: "Subscriptions",
  entertainment: "Entertainment",
  shopping: "Shopping",
  travel: "Travel",
  other: "Other",
};
const METHOD_NAME: Record<string, string> = {
  "50/30/20": "the 50/30/20 split (needs / wants / saving)",
  zero_based: "zero-based budgeting (every dollar assigned)",
  envelope: "envelope budgeting (fixed amounts per category)",
  pay_yourself_first: "pay-yourself-first (save first, spend the rest)",
  none: "no particular budgeting method",
};
export const KIND_LABEL: Record<string, string> = {
  emergency_target: "Emergency fund target",
  savings_milestone: "Savings milestones",
  budgeting_method: "Budgeting method",
  research_interest: "Research interests",
  category_priority: "Spending priorities",
  uncertainty_tolerance: "Planning for uncertainty",
  note: "Other things to remember",
};

/** Single-valued kinds replace the previous value instead of adding another. */
function uniqueKeyFor(v: MemoryValue): string | null {
  switch (v.kind) {
    case "emergency_target":
    case "budgeting_method":
    case "uncertainty_tolerance":
      return v.kind;
    case "category_priority":
      return `category_priority:${v.category}`;
    default:
      return null;
  }
}

/** Plain-language statement of what VELTRIX will remember. */
export function describeMemory(v: MemoryValue, currency = "USD"): string {
  switch (v.kind) {
    case "emergency_target":
      return `Keep ${v.months} month${v.months === 1 ? "" : "s"} of essential spending as an emergency reserve.`;
    case "savings_milestone":
      return `${v.text}${v.amountCents ? ` (${formatMoney(v.amountCents, currency)})` : ""}${v.date ? ` by ${v.date}` : ""}.`.replace(/\.\.$/, ".");
    case "budgeting_method":
      return `Budget using ${METHOD_NAME[v.method]}.`;
    case "research_interest":
      return `Interested in researching ${[...v.topics, ...v.symbols].join(", ")}.`;
    case "category_priority":
      return v.level === "protect" ? `${CATEGORY_NAME[v.category]} matters to me; cut elsewhere first.` : `${CATEGORY_NAME[v.category]} is flexible; it's the first place I'd cut back.`;
    case "uncertainty_tolerance":
      return v.level === "cautious" ? "Plan cautiously: assume spending can run higher than usual." : v.level === "comfortable" ? "I'm comfortable with tighter plans; use a narrower range." : "Use a balanced view of uncertainty.";
    case "note":
      return v.text;
  }
}

function serialize(r: { id: string; kind: string; value: Prisma.JsonValue; enabled: boolean; source: string; lastUsedAt: Date | null; createdAt: Date; updatedAt: Date }, currency: string) {
  const v = r.value as unknown as MemoryValue;
  return {
    id: r.id,
    kind: r.kind,
    kindLabel: KIND_LABEL[r.kind] ?? r.kind,
    value: v,
    text: describeMemory(v, currency),
    enabled: r.enabled,
    source: r.source,
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
export type SerializedMemory = ReturnType<typeof serialize>;

async function currencyOf(userId: string) {
  return (await db.userProfile.findUnique({ where: { userId }, select: { baseCurrency: true } }))?.baseCurrency ?? "USD";
}

export async function memoryEnabled(userId: string) {
  return (await db.userPreference.findUnique({ where: { userId }, select: { memoryEnabled: true } }))?.memoryEnabled ?? true;
}

export async function listMemory(userId: string) {
  const [rows, enabled, currency] = await Promise.all([db.memoryItem.findMany({ where: { userId }, orderBy: [{ kind: "asc" }, { createdAt: "asc" }] }), memoryEnabled(userId), currencyOf(userId)]);
  return { enabled, items: rows.map((r) => serialize(r, currency)), limit: MAX_MEMORY_ITEMS };
}

export async function saveMemory(userId: string, raw: unknown, source: "user" | "advisor" = "user") {
  const parsed = memoryValueSchema.safeParse(raw);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid memory.");
  const value = parsed.data;
  const uniqueKey = uniqueKeyFor(value);
  const json = value as unknown as Prisma.InputJsonValue;
  let row;
  if (uniqueKey) {
    row = await db.memoryItem.upsert({ where: { userId_uniqueKey: { userId, uniqueKey } }, create: { userId, kind: value.kind, uniqueKey, value: json, source }, update: { value: json, enabled: true, source } });
  } else {
    if ((await db.memoryItem.count({ where: { userId } })) >= MAX_MEMORY_ITEMS) throw badRequest(`Memory holds up to ${MAX_MEMORY_ITEMS} items. Delete some first.`);
    row = await db.memoryItem.create({ data: { userId, kind: value.kind, uniqueKey: null, value: json, source } });
  }
  await audit("memory.saved", { userId, metadata: { kind: value.kind, source } });
  return serialize(row, await currencyOf(userId));
}

export async function updateMemory(userId: string, id: string, patch: { value?: unknown; enabled?: boolean }) {
  const existing = await db.memoryItem.findFirst({ where: { id, userId } });
  if (!existing) throw notFound("Memory item");
  let value: MemoryValue | undefined;
  if (patch.value !== undefined) {
    const parsed = memoryValueSchema.safeParse(patch.value);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid memory.");
    if (parsed.data.kind !== existing.kind) throw badRequest("A memory item can't change its type.");
    value = parsed.data;
    const key = uniqueKeyFor(value);
    if (key !== existing.uniqueKey && key && (await db.memoryItem.findFirst({ where: { userId, uniqueKey: key, NOT: { id } } }))) throw badRequest("You already have a saved preference for that.");
  }
  const row = await db.memoryItem.update({
    where: { id },
    data: { ...(value ? { value: value as unknown as Prisma.InputJsonValue, uniqueKey: uniqueKeyFor(value) } : {}), ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}) },
  });
  return serialize(row, await currencyOf(userId));
}

export async function deleteMemory(userId: string, id: string) {
  const r = await db.memoryItem.deleteMany({ where: { id, userId } });
  if (!r.count) throw notFound("Memory item");
  await audit("memory.deleted", { userId });
}

export async function deleteAllMemory(userId: string) {
  const r = await db.memoryItem.deleteMany({ where: { userId } });
  await audit("memory.deleted", { userId, metadata: { count: r.count } });
  return r.count;
}

export async function setMemoryEnabled(userId: string, enabled: boolean) {
  await db.userPreference.upsert({ where: { userId }, create: { userId, memoryEnabled: enabled }, update: { memoryEnabled: enabled } });
  await audit("privacy.permission_changed", { userId, metadata: { permission: "memoryEnabled", enabled } });
  return enabled;
}

/** Enabled items, or none when memory is switched off. */
export async function activeMemory(userId: string) {
  if (!(await memoryEnabled(userId))) return [];
  const currency = await currencyOf(userId);
  const rows = await db.memoryItem.findMany({ where: { userId, enabled: true }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => serialize(r, currency));
}

export async function markMemoryUsed(userId: string, ids: string[]) {
  if (ids.length) await db.memoryItem.updateMany({ where: { userId, id: { in: ids } }, data: { lastUsedAt: new Date() } });
}

export interface PlanningPreferences {
  emergencyMonths: { months: number; memoryId: string } | null;
  tolerance: { level: "cautious" | "balanced" | "comfortable"; memoryId: string } | null;
  protect: { category: string; memoryId: string }[];
  flexible: { category: string; memoryId: string }[];
  budgetingMethod: { method: string; memoryId: string } | null;
  researchSymbols: string[];
}

/** What the plan engine and opportunities take from memory. */
export function planningPreferences(items: SerializedMemory[]): PlanningPreferences {
  const out: PlanningPreferences = { emergencyMonths: null, tolerance: null, protect: [], flexible: [], budgetingMethod: null, researchSymbols: [] };
  for (const m of items) {
    const v = m.value;
    if (v.kind === "emergency_target") out.emergencyMonths = { months: v.months, memoryId: m.id };
    else if (v.kind === "uncertainty_tolerance") out.tolerance = { level: v.level, memoryId: m.id };
    else if (v.kind === "category_priority") (v.level === "protect" ? out.protect : out.flexible).push({ category: v.category, memoryId: m.id });
    else if (v.kind === "budgeting_method") out.budgetingMethod = { method: v.method, memoryId: m.id };
    else if (v.kind === "research_interest") out.researchSymbols.push(...v.symbols);
  }
  return out;
}

export const TOLERANCE_VARIANCE_FACTOR = { cautious: 1.5, balanced: 1, comfortable: 0.75 } as const;
