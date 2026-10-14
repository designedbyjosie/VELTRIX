"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FinancialProfile } from "@/server/services/twin";
import { Button, Card, Field, FormError, Input, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { DollarInput, toCents } from "./common";

const CATEGORY_NAMES: Record<string, string> = {
  housing: "Housing",
  utilities: "Utilities",
  food: "Food & dining",
  transport: "Transportation",
  health: "Health",
  subscriptions: "Subscriptions",
  entertainment: "Entertainment",
  shopping: "Shopping",
  travel: "Travel",
  other: "Other",
};

/** Every assumption the projections use, editable and explained. */
export function Assumptions({ profile: p }: { profile: FinancialProfile }) {
  const router = useRouter();
  const toast = useToast();
  const s = p.settings;
  const [months, setMonths] = useState(String(s.emergencyMonths));
  const [ret, setRet] = useState({ best: String(s.annualReturnPct.best), expected: String(s.annualReturnPct.expected), adverse: String(s.annualReturnPct.adverse) });
  const [variance, setVariance] = useState(s.spendingVariancePct === null ? "" : String(s.spendingVariancePct));
  const [essential, setEssential] = useState(new Set(s.essentialCategories));
  const [excluded, setExcluded] = useState(new Set(s.excludedAccountIds));
  const [debts, setDebts] = useState<Record<string, { apr: string; payment: string }>>(
    Object.fromEntries(p.debts.map((d) => [d.id, { apr: d.aprPercent === null ? "" : String(d.aprPercent), payment: d.monthlyPaymentCents ? (d.monthlyPaymentCents / 100).toFixed(2) : "" }])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const num = (v: string, lo: number, hi: number) => {
      const n = Number(v);
      return v.trim() !== "" && Number.isFinite(n) && n >= lo && n <= hi ? n : null;
    };
    const em = num(months, 0, 24);
    const r = { best: num(ret.best, -50, 50), expected: num(ret.expected, -50, 50), adverse: num(ret.adverse, -90, 50) };
    if (em === null) return setError("Reserve target must be between 0 and 24 months.");
    if (r.best === null || r.expected === null || r.adverse === null) return setError("Returns must be percentages between −90 and 50.");
    const debtTerms: Record<string, { aprPercent: number | null; monthlyPaymentCents: number }> = {};
    for (const d of p.debts) {
      const t = debts[d.id];
      if (!t.apr.trim() && !t.payment.trim()) continue;
      const apr = t.apr.trim() ? num(t.apr, 0, 100) : null;
      const pay = t.payment.trim() ? toCents(t.payment) : 0;
      if ((t.apr.trim() && apr === null) || pay === null) return setError(`Check the rate and payment for ${d.name}.`);
      debtTerms[d.id] = { aprPercent: apr, monthlyPaymentCents: pay };
    }
    setSaving(true);
    try {
      await api("/api/plan/assumptions", {
        method: "PATCH",
        body: {
          emergencyMonths: em,
          annualReturnPct: r,
          spendingVariancePct: variance.trim() ? num(variance, 0, 100) : null,
          essentialCategories: [...essential],
          excludedAccountIds: [...excluded],
          debts: debtTerms,
        },
      });
      toast("Assumptions saved. Every projection now uses them.");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save assumptions.");
    } finally {
      setSaving(false);
    }
  }

  const allCategories = [...new Set([...Object.keys(CATEGORY_NAMES), ...p.categories.map((c) => c.slug)])].filter((x) => x !== "uncategorized");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Reserves and growth">
        <div className="space-y-3">
          <Field label="Emergency reserve target (months of essential spending)" htmlFor="a-months">
            <Input id="a-months" type="number" min={0} max={24} step={0.5} value={months} onChange={(e) => setMonths(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink2">Annual investment return (%)</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["adverse", "expected", "best"] as const).map((k) => (
                <Field key={k} label={k === "adverse" ? "Adverse" : k === "expected" ? "Expected" : "Best"} htmlFor={`a-r-${k}`}>
                  <Input id={`a-r-${k}`} inputMode="decimal" value={ret[k]} onChange={(e) => setRet({ ...ret, [k]: e.target.value })} />
                </Field>
              ))}
            </div>
          </fieldset>
          <Field label="Spending swing for best/adverse cases (%)" htmlFor="a-var" hint={s.derivedSpendingVariancePct !== null ? `Blank = ${s.derivedSpendingVariancePct}%, from how much your discretionary spending varied recently` : "Blank = 10% (default until there are 2 months of history)"}>
            <Input id="a-var" inputMode="decimal" value={variance} onChange={(e) => setVariance(e.target.value)} placeholder={String(s.derivedSpendingVariancePct ?? 10)} />
          </Field>
        </div>
      </Card>

      <Card title="Which spending is essential?">
        <p className="mb-3 text-xs text-ink2">Essential spending is what you&apos;d keep paying in a hard month. It sets your reserve target and stress-test runway.</p>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((slug) => {
            const on = essential.has(slug);
            return (
              <button
                key={slug}
                role="switch"
                aria-checked={on}
                onClick={() =>
                  setEssential((x) => {
                    const n = new Set(x);
                    if (on) n.delete(slug);
                    else n.add(slug);
                    return n;
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-blue bg-blue/20 text-ink" : "border-line text-ink3 hover:border-blue/60"}`}
              >
                {CATEGORY_NAMES[slug] ?? p.categories.find((c) => c.slug === slug)?.name ?? slug}
              </button>
            );
          })}
        </div>
      </Card>

      {p.debts.length > 0 && (
        <Card title="Debt terms">
          <p className="mb-3 text-xs text-ink2">Used to model interest and payoff. Leave blank if you don&apos;t know; VELTRIX won&apos;t guess a rate.</p>
          <ul className="space-y-3">
            {p.debts.map((d) => (
              <li key={d.id} className="grid grid-cols-[1fr_90px_130px] items-end gap-2">
                <div className="pb-2 text-sm">
                  {d.name}
                  <span className="num block text-xs text-ink3">{money(d.balanceCents, p.currency)} owed</span>
                </div>
                <Field label="APR %" htmlFor={`a-apr-${d.id}`}>
                  <Input id={`a-apr-${d.id}`} inputMode="decimal" value={debts[d.id].apr} onChange={(e) => setDebts({ ...debts, [d.id]: { ...debts[d.id], apr: e.target.value } })} />
                </Field>
                <Field label="Monthly payment" htmlFor={`a-pay-${d.id}`}>
                  <DollarInput id={`a-pay-${d.id}`} value={debts[d.id].payment} onChange={(v) => setDebts({ ...debts, [d.id]: { ...debts[d.id], payment: v } })} />
                </Field>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Accounts used for planning">
        <p className="mb-3 text-xs text-ink2">Turn off an account to leave it out of every projection (for example, money set aside for someone else). It stays in your net worth elsewhere.</p>
        <ul className="space-y-2">
          {p.accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <input
                id={`a-acc-${a.id}`}
                type="checkbox"
                className="size-4 accent-[#3B82F6]"
                checked={!excluded.has(a.id)}
                disabled={a.currency !== p.currency}
                onChange={(e) =>
                  setExcluded((x) => {
                    const n = new Set(x);
                    if (e.target.checked) n.delete(a.id);
                    else n.add(a.id);
                    return n;
                  })
                }
              />
              <label htmlFor={`a-acc-${a.id}`} className="flex-1">
                {a.name}
                {a.currency !== p.currency && <span className="ml-2 text-xs text-ink3">({a.currency}, not used in {p.currency} plans)</span>}
              </label>
              <span className="num text-ink2">{money(a.balanceCents, a.currency)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="lg:col-span-2">
        <FormError message={error} />
        <Button variant="primary" onClick={save} loading={saving} className="mt-2">
          Save assumptions
        </Button>
      </div>
    </div>
  );
}
