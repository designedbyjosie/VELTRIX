"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, Repeat } from "lucide-react";
import { Badge, Button, EmptyState, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/format";

export interface RecurringView {
  id: string;
  merchant: string;
  amountCents: number;
  currency: string;
  frequency: string;
  occurrences: number;
  lastObserved: string;
  nextExpected: string | null;
  estimatedAnnualCents: number;
  confidence: number;
  status: "SUSPECTED" | "CONFIRMED" | "DISMISSED";
  category: { name: string } | null;
  evidence: { date: string; amountCents: number }[];
}

export function RecurringList({ items }: { items: RecurringView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const visible = items.filter((i) => showDismissed || i.status !== "DISMISSED");
  const set = async (id: string, status: RecurringView["status"]) => {
    await api(`/api/recurring/${id}`, { method: "PATCH", body: { status } });
    toast(status === "CONFIRMED" ? "Marked as a subscription" : status === "DISMISSED" ? "Dismissed" : "Restored");
    router.refresh();
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink3">Detected from repeating charges with a regular interval and a similar amount. Suspected items aren&apos;t confirmed until you say so.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowDismissed((s) => !s)}>
            {showDismissed ? "Hide dismissed" : "Show dismissed"}
          </Button>
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await api("/api/recurring?refresh=1").catch(() => undefined);
              setBusy(false);
              router.refresh();
            }}
          >
            <RefreshCw className="size-3.5" /> Re-scan
          </Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState icon={<Repeat className="size-5" />} title="No recurring charges found" body="Detection needs at least three similar monthly charges from the same merchant." />
      ) : (
        <ul className="divide-y divide-line-soft rounded-[12px] border border-line-soft">
          {visible.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${r.status === "DISMISSED" ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {r.merchant}
                  {r.status === "SUSPECTED" && <Badge tone="info" title={`Confidence ${Math.round(r.confidence * 100)}% based on ${r.occurrences} charges`}>Suspected</Badge>}
                  {r.status === "CONFIRMED" && <Badge tone="pos">Confirmed</Badge>}
                </p>
                <p className="text-xs text-ink3">
                  {money(r.amountCents, r.currency)} {r.frequency.toLowerCase()} · last {shortDate(r.lastObserved)} · {r.occurrences} charges seen
                  {r.nextExpected ? ` · next expected ~${shortDate(r.nextExpected)}` : ""}
                </p>
              </div>
              <p className="num text-sm">
                {money(r.estimatedAnnualCents, r.currency, { noCents: true })}
                <span className="text-xs text-ink3">/yr est.</span>
              </p>
              <div className="flex gap-1">
                {r.status !== "CONFIRMED" && (
                  <Button size="sm" onClick={() => set(r.id, "CONFIRMED")}>
                    Confirm
                  </Button>
                )}
                {r.status !== "DISMISSED" ? (
                  <Button size="sm" variant="ghost" onClick={() => set(r.id, "DISMISSED")}>
                    Not recurring
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => set(r.id, "SUSPECTED")}>
                    Restore
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
