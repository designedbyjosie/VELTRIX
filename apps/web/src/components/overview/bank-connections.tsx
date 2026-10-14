"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Landmark, Link2, RefreshCw } from "lucide-react";
import { Badge, Button, ConfirmButton, FormError, Spinner, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/format";

interface Item {
  id: string;
  institutionName: string;
  status: string;
  errorCode: string | null;
  lastSyncedAt: string | null;
  accounts: { id: string; name: string; mask: string; type: string }[];
}

interface PlaidLinkHandler {
  open: () => void;
  destroy: () => void;
}
declare global {
  interface Window {
    Plaid?: {
      create: (opts: {
        token: string;
        onSuccess: (publicToken: string, metadata: { institution: { name: string; institution_id: string } | null }) => void;
        onExit: (err: { display_message?: string | null; error_message?: string } | null) => void;
      }) => PlaidLinkHandler;
    };
  }
}

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

function loadPlaid(): Promise<void> {
  if (window.Plaid) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PLAID_SCRIPT}"]`);
    const s = (existing as HTMLScriptElement) ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("Couldn't load Plaid. Check your connection or ad blocker.")));
    if (!existing) {
      s.src = PLAID_SCRIPT;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export function BankConnections({ configured, onChange }: { configured: boolean; onChange?: (connectedCount: number) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = (await api<{ items: Item[] }>("/api/banks")).items;
      setItems(next);
      onChange?.(next.length);
    } catch {
      setItems([]);
    }
  }, [onChange]);
  useEffect(() => {
    if (configured) load();
  }, [configured, load]);

  async function openLink(itemId?: string) {
    setError(null);
    setBusy(itemId ?? "new");
    try {
      const [{ link_token }] = await Promise.all([api<{ link_token: string }>("/api/banks/link-token", { body: itemId ? { itemId } : {} }), loadPlaid()]);
      const handler = window.Plaid!.create({
        token: link_token,
        onSuccess: async (publicToken, metadata) => {
          setBusy(itemId ?? "new");
          try {
            if (itemId) {
              await api(`/api/banks/${itemId}/sync`, { body: {} });
              toast("Bank reconnected");
            } else {
              const r = await api<{ result: { added?: number; error?: string } }>("/api/banks/exchange", { body: { publicToken, institution: { id: metadata.institution?.institution_id ?? null, name: metadata.institution?.name ?? "Bank" } } });
              toast(r.result.error ? "Bank connected — first import will retry shortly" : `Bank connected · ${r.result.added ?? 0} transactions imported`);
            }
            await load();
            router.refresh();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "The bank connection couldn't be completed.");
          } finally {
            setBusy(null);
            handler.destroy();
          }
        },
        onExit: (err) => {
          if (err) setError(err.display_message ?? "The bank connection was cancelled.");
          setBusy(null);
        },
      });
      handler.open();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Couldn't start the bank connection.");
      setBusy(null);
    }
  }

  if (!configured) {
    return (
      <div className="flex items-start gap-3">
        <Link2 className="mt-0.5 size-5 shrink-0 text-ink3" aria-hidden />
        <div className="text-sm">
          <p className="flex items-center gap-2">
            Automatic sync <Badge>Not configured</Badge>
          </p>
          <p className="mt-1 text-ink2">Linking banks needs Plaid credentials on the server (PLAID_CLIENT_ID, PLAID_SECRET). VELTRIX never asks for your bank username or password.</p>
          <p className="mt-2 text-xs text-ink3">Meanwhile, add accounts manually and import CSV statements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink2">Link accounts through Plaid. You sign in to your bank in Plaid&apos;s secure window — VELTRIX never sees your bank password and can&apos;t move money.</p>
      <FormError message={error} />
      {items === null ? (
        <Spinner className="size-4" />
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="panel-inner p-3">
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-cyan" aria-hidden />
                <span className="font-medium">{i.institutionName}</span>
                {i.status === "ok" ? <Badge tone="pos">Connected</Badge> : i.status === "login_required" ? <Badge tone="warn">Sign-in needed</Badge> : <Badge tone="neg">Error</Badge>}
              </div>
              <p className="mt-1 text-xs text-ink3">
                {i.accounts.length} account{i.accounts.length === 1 ? "" : "s"} · {i.lastSyncedAt ? `updated ${relativeTime(i.lastSyncedAt)}` : "not synced yet"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {i.status === "login_required" ? (
                  <Button size="sm" variant="primary" loading={busy === i.id} onClick={() => openLink(i.id)}>
                    Reconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    loading={busy === i.id}
                    onClick={async () => {
                      setBusy(i.id);
                      setError(null);
                      try {
                        const r = await api<{ added: number }>(`/api/banks/${i.id}/sync`, { body: {} });
                        toast(`Updated · ${r.added} new transactions`);
                        router.refresh();
                      } catch (e) {
                        setError(e instanceof ApiError ? e.message : "Sync failed.");
                      } finally {
                        setBusy(null);
                        load();
                      }
                    }}
                  >
                    <RefreshCw className="size-3.5" /> Sync now
                  </Button>
                )}
                <ConfirmButton
                  title={`Disconnect ${i.institutionName}?`}
                  body="Its accounts and the transactions imported from it are removed from VELTRIX. Your bank account itself isn't affected."
                  confirmLabel="Disconnect"
                  onConfirm={async () => {
                    await api(`/api/banks/${i.id}`, { method: "DELETE" });
                    toast("Bank disconnected");
                    await load();
                    router.refresh();
                  }}
                >
                  Disconnect
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="primary" className="w-full" loading={busy === "new"} onClick={() => openLink()}>
        <Link2 className="size-4" /> Connect a bank
      </Button>
      <p className="text-[11px] text-ink3">Balances and transactions refresh daily and when you press Sync now. Pending transactions appear once they post.</p>
    </div>
  );
}
