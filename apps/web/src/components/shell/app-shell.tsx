"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { NAV } from "./nav";
import { GlobalSearch } from "./global-search";
import { NotificationsMenu } from "./notifications";
import { UserMenu } from "./user-menu";

export interface ShellUser {
  displayName: string;
  email: string;
  plan: string;
  hasDemoData: boolean;
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? path === "/app" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] transition",
              active ? "brand-gradient text-white shadow-[0_6px_20px_-8px_rgba(80,110,255,.9)]" : "text-ink2 hover:bg-white/[0.04] hover:text-ink",
            )}
          >
            <Icon className={clsx("size-[17px]", active ? "text-white" : "text-ink3 group-hover:text-cyan")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_600px_at_70%_-200px,rgba(40,120,255,.12),transparent),radial-gradient(800px_400px_at_0%_100%,rgba(121,84,255,.07),transparent)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line-soft bg-bg/80 px-3 py-5 backdrop-blur lg:flex">
        <Link href="/app" className="mb-6 px-2" aria-label="VELTRIX home">
          <Logo />
        </Link>
        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
          <SideNav />
        </div>
        {user.hasDemoData && (
          <p className="mt-3 rounded-[10px] border border-warn/30 bg-warn/5 px-3 py-2 text-[11px] leading-4 text-[#FFCF85]">
            Demo data is loaded. Remove it any time in <Link href="/app/settings#data" className="underline">Settings</Link>.
          </p>
        )}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[#02060f]/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[260px] overflow-y-auto border-r border-line bg-bg px-3 py-5">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-md p-1 text-ink2 hover:bg-white/5">
                <X className="size-5" />
              </button>
            </div>
            <SideNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-soft bg-bg/75 px-4 backdrop-blur md:px-6">
          <button className="rounded-md p-1.5 text-ink2 hover:bg-white/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <NotificationsMenu />
            <UserMenu user={user} />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
