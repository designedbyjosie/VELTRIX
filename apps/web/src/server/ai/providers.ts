/**
 * Provider-independent language-model layer. The rest of the app only calls
 * `runToolConversation` / `completeText`; concrete providers implement their own
 * wire format. API keys stay on the server (see env.ts).
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import { TOOLS } from "./tools";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallRecord {
  name: string;
  input: unknown;
}

export interface ConversationResult {
  text: string;
  toolCalls: ToolCallRecord[];
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export interface LLMProvider {
  id: string;
  model: string;
  runToolConversation(opts: {
    system: string;
    history: ChatTurn[];
    executeTool: (name: string, input: unknown) => Promise<unknown>;
    maxToolRounds?: number;
  }): Promise<ConversationResult>;
  completeText(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
}

// ------------------------------------------------------------------ Anthropic (Claude)

class AnthropicProvider implements LLMProvider {
  id = "anthropic";
  private client: Anthropic;
  constructor(
    apiKey: string,
    public model: string,
    baseURL?: string | null,
  ) {
    this.client = new Anthropic({ apiKey, baseURL: baseURL ?? undefined, timeout: 120_000, maxRetries: 2 });
  }

  async runToolConversation({ system, history, executeTool, maxToolRounds = 6 }: Parameters<LLMProvider["runToolConversation"]>[0]): Promise<ConversationResult> {
    const tools: Anthropic.Tool[] = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.jsonSchema as Anthropic.Tool.InputSchema }));
    const messages: Anthropic.MessageParam[] = history.map((h) => ({ role: h.role, content: h.content }));
    const calls: ToolCallRecord[] = [];
    let tokensIn = 0;
    let tokensOut = 0;
    for (let round = 0; round <= maxToolRounds; round++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools,
        tool_choice: { type: "auto" },
        output_config: { effort: "medium" },
        messages,
      });
      tokensIn += response.usage.input_tokens;
      tokensOut += response.usage.output_tokens;
      if (response.stop_reason === "refusal") {
        return { text: "I can't help with that request. Try asking about your spending, budgets, goals, investments or saved items.", toolCalls: calls, tokensIn, tokensOut, model: response.model };
      }
      // Append the assistant turn unchanged so thinking blocks stay valid across tool rounds.
      messages.push({ role: "assistant", content: response.content });
      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0 || round === maxToolRounds) {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { text: text || "I couldn't produce an answer from the available data.", toolCalls: calls, tokensIn, tokensOut, model: response.model };
      }
      const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (tu) => {
          calls.push({ name: tu.name, input: tu.input });
          const out = await executeTool(tu.name, tu.input);
          return { type: "tool_result" as const, tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 60_000) };
        }),
      );
      messages.push({ role: "user", content: results });
    }
    return { text: "I couldn't complete that analysis.", toolCalls: calls, tokensIn, tokensOut, model: this.model };
  }

  async completeText({ system, prompt, maxTokens = 2000 }: { system: string; prompt: string; maxTokens?: number }) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return "";
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
}

// ------------------------------------------------------------------ OpenAI-compatible chat completions

interface OAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

/** For any provider exposing an OpenAI-compatible /chat/completions endpoint (set AI_BASE_URL). */
class OpenAICompatibleProvider implements LLMProvider {
  id = "openai";
  constructor(
    private apiKey: string,
    public model: string,
    private baseUrl: string,
  ) {}

  private async call(body: Record<string, unknown>) {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, ...body }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`);
    return (await res.json()) as { choices: { message: OAIMessage; finish_reason: string }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
  }

  async runToolConversation({ system, history, executeTool, maxToolRounds = 6 }: Parameters<LLMProvider["runToolConversation"]>[0]): Promise<ConversationResult> {
    const tools = TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.jsonSchema } }));
    const messages: OAIMessage[] = [{ role: "system", content: system }, ...history.map((h) => ({ role: h.role, content: h.content }))];
    const calls: ToolCallRecord[] = [];
    let tokensIn = 0;
    let tokensOut = 0;
    for (let round = 0; round <= maxToolRounds; round++) {
      const data = await this.call({ messages, tools, tool_choice: "auto" });
      tokensIn += data.usage?.prompt_tokens ?? 0;
      tokensOut += data.usage?.completion_tokens ?? 0;
      const msg = data.choices[0]?.message;
      if (!msg) break;
      messages.push(msg);
      if (!msg.tool_calls?.length || round === maxToolRounds) return { text: (msg.content ?? "").trim(), toolCalls: calls, tokensIn, tokensOut, model: this.model };
      for (const tc of msg.tool_calls) {
        let input: unknown = {};
        try {
          input = JSON.parse(tc.function.arguments || "{}");
        } catch {
          input = {};
        }
        calls.push({ name: tc.function.name, input });
        const out = await executeTool(tc.function.name, input);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 60_000) });
      }
    }
    return { text: "I couldn't complete that analysis.", toolCalls: calls, tokensIn, tokensOut, model: this.model };
  }

  async completeText({ system, prompt, maxTokens = 2000 }: { system: string; prompt: string; maxTokens?: number }) {
    const data = await this.call({ messages: [{ role: "system", content: system }, { role: "user", content: prompt }], max_tokens: maxTokens });
    return (data.choices[0]?.message?.content ?? "").trim();
  }
}

let cached: LLMProvider | null | undefined;

/** The configured provider, or null when AI credentials are not configured. */
export function llm(): LLMProvider | null {
  if (cached !== undefined) return cached;
  const { provider, apiKey, model, baseUrl } = env.ai;
  if (!apiKey || provider === "none") cached = null;
  else if (provider === "anthropic") cached = new AnthropicProvider(apiKey, model ?? "claude-opus-5-5", baseUrl);
  else if (provider === "openai" && model) cached = new OpenAICompatibleProvider(apiKey, model, baseUrl ?? "https://api.openai.com/v1");
  else cached = null;
  return cached;
}
