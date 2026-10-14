"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

interface Item {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: Item[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const load = useCallback(() => api<{ unread: number; items: Item[] }>("/api/notifications").then(setData).catch(() => undefined), []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          load();
        }}
        className="relative rounded-[10px] p-2 text-ink2 hover:bg-white/5 hover:text-ink"
        aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {!!data?.unread && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-cyan shadow-[0_0_8px_#39D9FF]" />}
      </button>
      {open && (
        <div className="glass absolute right-0 top-12 z-40 w-[340px] max-w-[calc(100vw-32px)] rounded-[14px] shadow-2xl">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {!!data?.unread && (
              <button className="text-xs text-cyan hover:underline" onClick={async () => { await api("/api/notifications", { body: { id: "all" } }); load(); }}>
                Mark all read
              </button>
            )}
          </div>
          {!data?.items.length ? (
            <p className="px-4 py-6 text-center text-sm text-ink2">You&apos;re all caught up. Price drops and alerts will show up here.</p>
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto py-1">
              {data.items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "#"}
                    onClick={() => api("/api/notifications", { body: { id: n.id } }).then(load)}
                    className="block px-4 py-2.5 hover:bg-white/5"
                  >
                    <p className={`text-sm ${n.read ? "text-ink2" : "font-medium text-ink"}`}>{n.title}</p>
                    <p className="mt-0.5 text-xs text-ink3">{n.body}</p>
                    <p className="mt-1 text-[10px] text-ink3">{relativeTime(n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
