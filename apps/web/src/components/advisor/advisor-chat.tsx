"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, Database, MessageSquarePlus, Send, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, FormError, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/format";

interface Evidence {
  tools: { name: string; label: string; provenance: string[] }[];
  mode: "builtin" | "llm";
  fallbackNote: string | null;
}
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: Evidence | null;
  createdAt: string;
}
export interface AdvisorStatus {
  mode: "llm" | "builtin";
  provider: string | null;
  reason: "ok" | "not_configured" | "no_consent";
}

const PROVENANCE: Record<string, { label: string; tone: "info" | "pos" | "warn" | "violet" | "demo" | "neutral" }> = {
  user: { label: "Your records", tone: "info" },
  "verified-account": { label: "Account data", tone: "pos" },
  observed: { label: "Observed prices", tone: "violet" },
  provider: { label: "Market data provider", tone: "neutral" },
  demo: { label: "Demo market data", tone: "demo" },
  estimate: { label: "Calculated estimate", tone: "warn" },
  education: { label: "General education", tone: "neutral" },
};

const SUGGESTIONS = ["Where did my money go this month?", "Which categories are over budget?", "How much could I save by reducing subscriptions?", "How am I progressing toward my emergency fund?", "Compare VOO and QQQ", "Can I afford a $350 purchase?"];

function Content({ text }: { text: string }) {
  // Plain-text rendering with line breaks and bullets; never injects HTML.
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((line, i) =>
        line.startsWith("• ") || line.startsWith("- ") ? (
          <p key={i} className="flex gap-2 pl-1">
            <span className="text-cyan" aria-hidden>
              •
            </span>
            <span>{line.slice(2)}</span>
          </p>
        ) : line.trim() ? (
          <p key={i}>{line.replace(/\*\*(.+?)\*\*/g, "$1")}</p>
        ) : null,
      )}
    </div>
  );
}

export function AdvisorChat({ status, conversations: initialConvos }: { status: AdvisorStatus; conversations: { id: string; title: string; updatedAt: string }[] }) {
  const params = useSearchParams();
  const [convos, setConvos] = useState(initialConvos);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(params.get("q") ?? "");
  const [sending, setSending] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function open(id: string) {
    setLoadingConvo(true);
    setError(null);
    try {
      const r = await api<{ conversation: { id: string; messages: Message[] } }>(`/api/advisor/conversations/${id}`);
      setConvoId(id);
      setMessages(r.conversation.messages);
    } finally {
      setLoadingConvo(false);
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setInput("");
    setError(null);
    const optimistic: Message = { id: `tmp-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    setSending(true);
    try {
      const r = await api<{ conversationId: string; message: Message }>("/api/advisor/chat", { body: { conversationId: convoId, message } });
      setMessages((m) => [...m, r.message]);
      if (!convoId) {
        setConvoId(r.conversationId);
        setConvos((c) => [{ id: r.conversationId, title: message.slice(0, 80), updatedAt: new Date().toISOString() }, ...c]);
      }
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(message);
      setError(e instanceof ApiError ? e.message : "The advisor couldn't respond. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="panel hidden h-[calc(100dvh-200px)] flex-col p-3 lg:flex">
        <Button
          variant="secondary"
          className="mb-3 w-full"
          onClick={() => {
            setConvoId(null);
            setMessages([]);
          }}
        >
          <MessageSquarePlus className="size-4" /> New conversation
        </Button>
        <p className="px-2 pb-1 text-xs text-ink3">History</p>
        <ul className="flex-1 space-y-0.5 overflow-y-auto">
          {convos.length === 0 && <li className="px-2 text-xs text-ink3">No conversations yet.</li>}
          {convos.map((c) => (
            <li key={c.id} className={`group flex items-center rounded-[8px] ${c.id === convoId ? "bg-blue/15" : "hover:bg-white/5"}`}>
              <button className="min-w-0 flex-1 px-2 py-1.5 text-left" onClick={() => open(c.id)}>
                <span className="block truncate text-sm">{c.title}</span>
                <span className="block text-[10px] text-ink3">{relativeTime(c.updatedAt)}</span>
              </button>
              <button
                aria-label={`Delete conversation ${c.title}`}
                className="mr-1 rounded p-1 text-ink3 opacity-0 hover:text-neg group-hover:opacity-100 focus:opacity-100"
                onClick={async () => {
                  await api(`/api/advisor/conversations/${c.id}`, { method: "DELETE" });
                  setConvos((x) => x.filter((y) => y.id !== c.id));
                  if (convoId === c.id) {
                    setConvoId(null);
                    setMessages([]);
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="panel flex h-[calc(100dvh-200px)] min-h-[480px] flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-3 text-xs">
          {status.mode === "llm" ? (
            <Badge tone="pos">AI model connected ({status.provider})</Badge>
          ) : (
            <Badge tone="neutral">Built-in analysis</Badge>
          )}
          <span className="text-ink3">
            {status.reason === "not_configured" && "No AI provider is configured, so answers come from VELTRIX's deterministic analysis of your data."}
            {status.reason === "no_consent" && (
              <>
                An AI provider is available. <Link href="/app/settings#privacy" className="text-cyan hover:underline">Allow AI processing</Link> to use it — your question and the data needed to answer it are sent to the provider.
              </>
            )}
            {status.reason === "ok" && "Numbers come from VELTRIX's calculations; the model explains them."}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
          {loadingConvo ? (
            <div className="grid h-full place-items-center">
              <Spinner />
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
              <span className="mb-4 grid size-14 place-items-center rounded-[16px] bg-gradient-to-br from-blue to-violet shadow-[0_0_30px_rgba(121,84,255,.45)]">
                <Sparkles className="size-7 text-white" aria-hidden />
              </span>
              <h2 className="font-display text-xl font-semibold">Ask about your money</h2>
              <p className="mt-1 text-sm text-ink2">Answers use your VELTRIX records and show what data they relied on. Information only — not financial advice.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-bg2 px-3 py-1.5 text-xs text-ink2 hover:border-blue hover:text-ink">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="mx-auto max-w-3xl space-y-5">
              {messages.map((m) => (
                <li key={m.id} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
                  {m.role === "assistant" && (
                    <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-blue to-violet">
                      <Bot className="size-4 text-white" aria-hidden />
                    </span>
                  )}
                  <div className={m.role === "user" ? "max-w-[80%] rounded-[14px] rounded-br-[4px] bg-blue/20 px-4 py-2.5 text-sm" : "min-w-0 flex-1 text-sm leading-relaxed text-ink"}>
                    <Content text={m.content} />
                    {m.role === "assistant" && m.evidence && (
                      <div className="mt-3 rounded-[10px] border border-line-soft bg-bg2/60 p-3">
                        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink3">
                          <Database className="size-3" aria-hidden /> {m.evidence.tools.length ? "Data used for this answer" : "No account data was needed"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.evidence.tools.map((t, i) => (
                            <Badge key={`${t.name}-${i}`} tone="neutral" title={t.name}>
                              {t.label}
                            </Badge>
                          ))}
                          {[...new Set(m.evidence.tools.flatMap((t) => t.provenance))].map((p) => (
                            <Badge key={p} tone={PROVENANCE[p]?.tone ?? "neutral"}>
                              {PROVENANCE[p]?.label ?? p}
                            </Badge>
                          ))}
                        </div>
                        {m.evidence.fallbackNote && <p className="mt-2 text-[11px] text-warn">{m.evidence.fallbackNote}</p>}
                        <p className="mt-1.5 text-[10px] text-ink3">{m.evidence.mode === "llm" ? "Written by an AI model from VELTRIX-calculated data." : "Generated by VELTRIX's built-in analysis."}</p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {sending && (
                <li className="flex items-center gap-3 text-sm text-ink2">
                  <Spinner className="size-4" /> Analyzing your data…
                </li>
              )}
            </ol>
          )}
          <div ref={endRef} />
        </div>
        <form
          className="border-t border-line-soft p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <FormError message={error} />
          <div className="mt-1 flex items-end gap-2">
            <label htmlFor="advisor-input" className="sr-only">
              Ask the AI advisor
            </label>
            <textarea
              id="advisor-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Ask about spending, budgets, goals, investments, purchases…"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-[12px] border border-line bg-bg2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink3 outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
            />
            <Button type="submit" variant="primary" className="h-11" loading={sending} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-ink3">VELTRIX can be wrong. It can&apos;t move money, place trades or make bookings.</p>
        </form>
      </section>
    </div>
  );
}
