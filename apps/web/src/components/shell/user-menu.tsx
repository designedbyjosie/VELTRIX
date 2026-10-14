"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Puzzle, Settings, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ShellUser } from "./app-shell";

export function UserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const initials = user.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2.5 rounded-[12px] px-1.5 py-1 hover:bg-white/5">
        <span className="brand-gradient grid size-8 place-items-center rounded-full text-xs font-semibold text-white">{initials}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-medium leading-4 text-ink">{user.displayName}</span>
          <span className="block text-[11px] capitalize leading-4 text-cyan">{user.plan}</span>
        </span>
        <ChevronDown className="size-4 text-ink3" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 top-12 z-40 w-60 rounded-[14px] py-1.5 shadow-2xl">
          <p className="truncate px-4 py-2 text-xs text-ink3">{user.email}</p>
          {[
            { href: "/app/settings", label: "Profile & preferences", icon: Settings },
            { href: "/app/settings#extension", label: "Browser extension", icon: Puzzle },
            { href: "/app/settings#security", label: "Security & privacy", icon: ShieldCheck },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} role="menuitem" href={href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink2 hover:bg-white/5 hover:text-ink">
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
          <button
            role="menuitem"
            onClick={async () => {
              await api("/api/auth/logout", { body: {} }).catch(() => undefined);
              window.location.href = "/";
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-ink2 hover:bg-white/5 hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
