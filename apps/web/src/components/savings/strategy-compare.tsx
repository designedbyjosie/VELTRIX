"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui";
import { money } from "@/lib/format";

/** Deterministic comparison: months to reach a target at different monthly amounts (no growth assumed). */
export function StrategyCompare({ defaultTargetCents, savedCents, reducibleMonthlyCents }: { defaultTargetCents: number; savedCents: number; reducibleMonthlyCents: number }) {
  const [target, setTarget] = useState((defaultTargetCents / 100).toFixed(0));
  const [monthly, setMonthly] = useState("500");
  const t = Math.round((Number(target.replace(/[,$]/g, "")) || 0) * 100);
  const m = Math.round((Number(monthly.replace(/[,$]/g, "")) || 0) * 100);
  const remaining = Math.max(0, t - savedCents);
  const rows = [
    { label: "Your monthly amount", cents: m },
    { label: "+ cancel suspected subscriptions", cents: m + reducibleMonthlyCents, hint: `+${money(reducibleMonthlyCents)}/mo if all were cancelled` },
    { label: "+ 10% more", cents: Math.round(m * 1.1) },
    { label: "+ 25% more", cents: Math.round(m * 1.25) },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target" htmlFor="s-target">
          <Input id="s-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="Monthly saving" htmlFor="s-monthly">
          <Input id="s-monthly" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </Field>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Months to reach the target</caption>
        <thead className="text-left text-xs text-ink3">
          <tr>
            <th className="pb-2 font-medium">Strategy</th>
            <th className="pb-2 text-right font-medium">Per month</th>
            <th className="pb-2 text-right font-medium">Months</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line-soft">
              <td className="py-2 text-ink2">
                {r.label}
                {r.hint && <span className="block text-[11px] text-ink3">{r.hint}</span>}
              </td>
              <td className="num py-2 text-right">{money(r.cents, "USD", { noCents: true })}</td>
              <td className="num py-2 text-right font-medium">{r.cents > 0 ? Math.ceil(remaining / r.cents) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-ink3">Starts from {money(savedCents)} already saved. Assumes no interest or investment growth, and that contributions happen every month.</p>
    </div>
  );
}
