"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_LAYOUT, type DashboardWidget } from "@veltrix/shared";
import { Button, FormError, Modal } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

/** Choose which dashboard widgets show, and in what order. */
export function DashboardCustomizer({ layout }: { layout: DashboardWidget[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<DashboardWidget[]>([]);
  const [visible, setVisible] = useState<Set<DashboardWidget>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    // Visible widgets first in their current order, then hidden ones in default order.
    setOrder([...layout, ...DEFAULT_DASHBOARD_LAYOUT.filter((w) => !layout.includes(w))]);
    setVisible(new Set(layout));
    setError(null);
    setOpen(true);
  }
  function move(i: number, d: -1 | 1) {
    setOrder((o) => {
      const next = [...o];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  }
  async function save(next: DashboardWidget[]) {
    setSaving(true);
    setError(null);
    try {
      await api("/api/settings/dashboard", { method: "PATCH", body: { layout: next } });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your layout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={start}>
        <SlidersHorizontal className="size-3.5" /> Customize dashboard
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Customize your dashboard" description="Choose what shows on your home page and in what order. You can also ask the advisor, e.g. “move my goals to the top”.">
        <ul className="space-y-1.5">
          {order.map((id, i) => {
            const w = DASHBOARD_WIDGETS.find((x) => x.id === id)!;
            return (
              <li key={id} className="flex items-center gap-3 rounded-[10px] border border-line-soft bg-bg2/60 px-3 py-2">
                <input
                  id={`w-${id}`}
                  type="checkbox"
                  className="size-4 accent-[#3B82F6]"
                  checked={visible.has(id)}
                  onChange={(e) =>
                    setVisible((v) => {
                      const n = new Set(v);
                      if (e.target.checked) n.add(id);
                      else n.delete(id);
                      return n;
                    })
                  }
                />
                <label htmlFor={`w-${id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-sm font-medium">{w.label}</span>
                  <span className="block text-xs text-ink3">{w.description}</span>
                </label>
                <button type="button" className="rounded p-1 text-ink3 hover:text-ink disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${w.label} up`}>
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" className="rounded p-1 text-ink3 hover:text-ink disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${w.label} down`}>
                  <ArrowDown className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
        <FormError message={error} />
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => save([...DEFAULT_DASHBOARD_LAYOUT])} disabled={saving}>
            Reset to default
          </Button>
          <span className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={() => save(order.filter((w) => visible.has(w)))}>
              Save
            </Button>
          </span>
        </div>
      </Modal>
    </>
  );
}
