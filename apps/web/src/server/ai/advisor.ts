import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { HttpError, notFound } from "../errors";
import { hasConsent } from "../services/users";
import { todayIn } from "../dates";
import { builtinAnswer } from "./builtin";
import { ADVISOR_SYSTEM_PROMPT, ARTICLE_SUMMARY_PROMPT } from "./prompts";
import { llm } from "./providers";
import { runTool, type ToolContext } from "./tools";

export interface AdvisorStatus {
  mode: "llm" | "builtin";
  provider: string | null;
  reason: "ok" | "not_configured" | "no_consent";
}

export async function advisorStatus(userId: string): Promise<AdvisorStatus> {
  const provider = llm();
  if (!provider) return { mode: "builtin", provider: null, reason: "not_configured" };
  if (!(await hasConsent(userId, "AI_PROCESSING"))) return { mode: "builtin", provider: provider.id, reason: "no_consent" };
  return { mode: "llm", provider: provider.id, reason: "ok" };
}

async function enforceDailyLimit(userId: string) {
  const since = new Date(Date.now() - 86_400_000);
  const count = await db.aIMessage.count({ where: { userId, role: "USER", createdAt: { gte: since } } });
  if (count >= env.ai.dailyMessageLimit) throw new HttpError(429, "ai_limit", `You've reached today's limit of ${env.ai.dailyMessageLimit} advisor messages. It resets within 24 hours.`);
}

export async function sendAdvisorMessage(userId: string, ctx: Omit<ToolContext, "userId">, input: { conversationId?: string | null; message: string }) {
  await enforceDailyLimit(userId);
  let conversation = input.conversationId ? await db.aIConversation.findFirst({ where: { id: input.conversationId, userId } }) : null;
  if (input.conversationId && !conversation) throw notFound("Conversation");
  conversation ??= await db.aIConversation.create({ data: { userId, title: input.message.slice(0, 80) } });

  const history = await db.aIMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" }, take: 30 });
  await db.aIMessage.create({ data: { conversationId: conversation.id, userId, role: "USER", content: input.message } });

  const toolCtx: ToolContext = { userId, ...ctx };
  const status = await advisorStatus(userId);
  const evidence: { name: string; label: string; provenance: string[] }[] = [];
  let text: string;
  let provider = "builtin";
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let fallbackNote: string | null = null;

  if (status.mode === "llm") {
    try {
      const p = llm()!;
      const result = await p.runToolConversation({
        system: ADVISOR_SYSTEM_PROMPT,
        history: [
          ...history.map((h) => ({ role: h.role === "USER" ? ("user" as const) : ("assistant" as const), content: h.content })),
          { role: "user", content: `[Context: today is ${todayIn(ctx.timezone)}; base currency ${ctx.currency}]\n\n${input.message}` },
        ],
        executeTool: async (name, toolInput) => {
          // userId comes from the authenticated session, never from the model.
          const r = await runTool(toolCtx, name, toolInput);
          evidence.push({ name, label: r.label, provenance: r.provenance });
          return r.data;
        },
      });
      text = result.text;
      provider = p.id;
      model = result.model;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
    } catch (err) {
      console.error("[ai] provider failed; using built-in analysis", err);
      const b = await builtinAnswer(toolCtx, input.message);
      text = b.text;
      evidence.push(...b.tools);
      fallbackNote = "The AI provider couldn't be reached, so this answer comes from VELTRIX's built-in analysis.";
    }
  } else {
    const b = await builtinAnswer(toolCtx, input.message);
    text = b.text;
    evidence.push(...b.tools);
  }

  const evidenceJson = { tools: evidence, mode: provider === "builtin" ? "builtin" : "llm", fallbackNote, statusReason: status.reason } as Prisma.InputJsonValue;
  const assistant = await db.aIMessage.create({
    data: { conversationId: conversation.id, userId, role: "ASSISTANT", content: text, evidence: evidenceJson, provider, model, tokensIn, tokensOut },
  });
  await db.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  return { conversationId: conversation.id, message: serializeMessage(assistant), status };
}

function serializeMessage(m: { id: string; role: string; content: string; evidence: Prisma.JsonValue | null; provider: string | null; createdAt: Date }) {
  return { id: m.id, role: m.role === "USER" ? "user" : "assistant", content: m.content, evidence: m.evidence as unknown, provider: m.provider, createdAt: m.createdAt.toISOString() };
}
export type SerializedMessage = ReturnType<typeof serializeMessage>;

export async function listConversations(userId: string) {
  return db.aIConversation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true } });
}

export async function getConversation(userId: string, id: string) {
  const c = await db.aIConversation.findFirst({ where: { id, userId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!c) throw notFound("Conversation");
  return { id: c.id, title: c.title, messages: c.messages.map(serializeMessage) };
}

export async function deleteConversation(userId: string, id: string) {
  const c = await db.aIConversation.findFirst({ where: { id, userId } });
  if (!c) throw notFound("Conversation");
  await db.aIConversation.delete({ where: { id } });
}

/**
 * Summarize page-derived article content. Returns null unless a model is configured
 * and the user consented to AI processing. Page text is wrapped as untrusted data.
 */
export async function summarizeArticle(userId: string, a: { headline: string; publisher: string | null; description: string | null; excerpt: string | null }) {
  const status = await advisorStatus(userId);
  if (status.mode !== "llm" || !a.excerpt) return null;
  const strip = (s: string) => s.replace(/<\/?untrusted_page_content>/gi, "");
  const prompt = `<untrusted_page_content>\nHeadline: ${strip(a.headline)}\nPublisher: ${strip(a.publisher ?? "unknown")}\nDescription: ${strip(a.description ?? "")}\nText: ${strip(a.excerpt)}\n</untrusted_page_content>`;
  try {
    const out = await llm()!.completeText({ system: ARTICLE_SUMMARY_PROMPT, prompt, maxTokens: 1500 });
    if (!out || out.trim() === "NOT_FINANCIAL") return null;
    return out.slice(0, 1200);
  } catch (err) {
    console.error("[ai] summary failed", err);
    return null;
  }
}
