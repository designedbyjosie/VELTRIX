"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ChartCandlestick, Newspaper, Plane, Search, ShoppingBag, Sparkles, Target } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";

interface Hit {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const ICONS: Record<string, typeof Search> = { transaction: ArrowLeftRight, instrument: ChartCandlestick, goal: Target, product: ShoppingBag, article: Newspaper, insight: Sparkles, trip: Plane };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ hits: Hit[] }>(`/api/search?q=${encodeURIComponent(q.trim())}`);
        setHits(r.hits);
        setActive(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative w-full max-w-[520px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink3" aria-hidden />
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(hits.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && hits[active]) {
            router.push(hits[active].href);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          }
        }}
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-label="Search transactions, stocks, deals, goals and more"
        placeholder="Search anything… stocks, deals, expenses, travel"
        className="h-10 w-full rounded-[10px] border border-line-soft bg-panel/70 pl-9 pr-10 text-sm text-ink placeholder:text-ink3 outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[10px] text-ink3 sm:block">/</kbd>
      {open && q.trim().length >= 2 && (
        <div className="glass absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-[12px] shadow-2xl">
          {loading && hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink2">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink2">No matches for “{q}”.</p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
              {hits.map((h, i) => {
                const Icon = ICONS[h.type] ?? Search;
                return (
                  <li key={`${h.type}-${h.id}`} role="option" aria-selected={i === active}>
                    <Link href={h.href} className={`flex items-center gap-3 px-4 py-2 ${i === active ? "bg-blue/15" : "hover:bg-white/5"}`} onMouseEnter={() => setActive(i)}>
                      <Icon className="size-4 shrink-0 text-cyan" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{h.title}</span>
                        <span className="block truncate text-xs text-ink3">{h.subtitle}</span>
                      </span>
                      <span className="ml-auto text-[10px] capitalize text-ink3">{h.type}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
