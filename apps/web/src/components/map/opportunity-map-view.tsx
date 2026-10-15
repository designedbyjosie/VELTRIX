"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, EyeOff, Info, Star } from "lucide-react";
import { formatMoney, type MapAreaId } from "@veltrix/shared";
import { Badge, Button, Card, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { OpportunityMapResult } from "@/server/services/opportunity-map";

type Area = OpportunityMapResult["areas"][number];

const STATUS = {
  focus: { label: "Needs attention", tone: "warn" },
  room: { label: "Room to improve", tone: "info" },
  unknown: { label: "Not enough data", tone: "neutral" },
  strong: { label: "In good shape", tone: "pos" },
} as const;
const LEVEL = { low: "Low", medium: "Medium", high: "High" } as const;
const IMPACT_TONE = { possible_savings: "text-pos", at_stake: "text-warn", gap: "text-ink", none: "text-ink3" } as const;
const MAX_FOCUS = 3;
const MAX_COMPARE = 3;

export function OpportunityMapView({ map }: { map: OpportunityMapResult }) {
  const router = useRouter();
  const toast = useToast();
  const [prefs, setPrefs] = useState(map.prefs);
  const [compare, setCompare] = useState<MapAreaId[]>([]);
  useEffect(() => setPrefs(map.prefs), [map.prefs]);

  const save = async (next: { focus?: MapAreaId[]; hidden?: MapAreaId[] }, message: string) => {
    const prev = prefs;
    setPrefs((p) => ({ ...p, ...next }));
    try {
      await api("/api/map", { method: "PATCH", body: next });
      toast(message);
      router.refresh();
    } catch (e) {
      setPrefs(prev);
      toast(e instanceof ApiError ? e.message : "Couldn't save that.", "neg");
    }
  };

  const toggleFocus = (a: Area) => {
    if (prefs.focus.includes(a.id)) return save({ focus: prefs.focus.filter((f) => f !== a.id) }, `${a.title}: removed from your priorities`);
    if (prefs.focus.length >= MAX_FOCUS) return toast(`Choose up to ${MAX_FOCUS} priorities. Remove one first.`, "neg");
    return save({ focus: [...prefs.focus, a.id] }, `${a.title}: added to your priorities`);
  };
  const hide = (a: Area) => save({ hidden: [...prefs.hidden, a.id], focus: prefs.focus.filter((f) => f !== a.id) }, `${a.title} hidden`);
  const unhide = (a: Area) => save({ hidden: prefs.hidden.filter((h) => h !== a.id) }, `${a.title} is back on your map`);
  const toggleCompare = (id: MapAreaId) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? (toast(`Compare up to ${MAX_COMPARE} at a time.`, "neg"), c) : [...c, id]));

  const money = (c: number) => formatMoney(c, map.currency);
  const all = [...map.areas, ...map.hidden];
  const compared = compare.map((id) => all.find((a) => a.id === id)).filter((a): a is Area => !!a);
  const focusTitles = prefs.focus.map((f) => all.find((a) => a.id === f)?.title).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink2">
          {focusTitles.length ? (
            <>
              <span className="text-ink">Your priorities:</span> {focusTitles.join(" · ")}
            </>
          ) : (
            <>Mark up to {MAX_FOCUS} areas with the star to put what matters to you first. Until then, areas needing attention come first.</>
          )}
        </p>
        <p className="shrink-0 text-xs text-ink3">Amounts are estimates from your data, not promises.</p>
      </div>

      {compared.length >= 2 && (
        <Card title="Side by side" action={<Button size="sm" variant="ghost" onClick={() => setCompare([])}>Clear</Button>}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs text-ink3">
                  <th className="px-1 py-2 font-medium" />
                  {compared.map((a) => (
                    <th key={a.id} className="px-1 py-2 font-medium text-ink">
                      {a.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft align-top">
                {[
                  { k: "Impact", v: (a: Area) => (a.impact.cents !== null ? `${a.impact.label}: ${money(a.impact.cents)}` : a.impact.label) },
                  { k: "Effort", v: (a: Area) => LEVEL[a.effort] },
                  { k: "Confidence", v: (a: Area) => `${LEVEL[a.confidence]} (${a.confidenceBasis})` },
                  { k: "Time to benefit", v: (a: Area) => a.timeToBenefit },
                  { k: "Missing", v: (a: Area) => (a.dependencies.length ? a.dependencies.join("; ") : "Nothing") },
                  { k: "Next step", v: (a: Area) => a.nextStep.label },
                ].map((row) => (
                  <tr key={row.k}>
                    <td className="px-1 py-2 text-xs text-ink3">{row.k}</td>
                    {compared.map((a) => (
                      <td key={a.id} className="px-1 py-2 text-ink2">
                        {row.v(a)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink3">Different kinds of amounts (possible savings, interest at stake, a gap to close) aren&apos;t directly comparable or additive.</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {map.areas.map((a) => (
          <AreaCard key={a.id} a={a} money={money} focused={prefs.focus.includes(a.id)} rank={prefs.focus.indexOf(a.id)} comparing={compare.includes(a.id)} onFocus={() => toggleFocus(a)} onHide={() => hide(a)} onCompare={() => toggleCompare(a.id)} />
        ))}
      </div>

      {map.hidden.length > 0 && (
        <details className="panel p-4">
          <summary className="cursor-pointer text-sm text-ink2">
            {map.hidden.length} area{map.hidden.length === 1 ? "" : "s"} you said aren&apos;t for you
          </summary>
          <ul className="mt-2 divide-y divide-line-soft">
            {map.hidden.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink">{a.title}</span>
                <Button size="sm" variant="ghost" onClick={() => unhide(a)}>
                  Show again
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function AreaCard({ a, money, focused, rank, comparing, onFocus, onHide, onCompare }: { a: Area; money: (c: number) => string; focused: boolean; rank: number; comparing: boolean; onFocus: () => void; onHide: () => void; onCompare: () => void }) {
  const s = STATUS[a.status];
  return (
    <section className={`panel flex flex-col p-4 ${focused ? "border-cyan/50" : ""}`} aria-labelledby={`area-${a.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`area-${a.id}`} className="font-display text-base font-semibold text-ink">
            {a.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={s.tone}>{s.label}</Badge>
            {focused && <Badge tone="violet">Priority {rank + 1}</Badge>}
            {a.opportunities > 0 && <Badge tone="info">{a.opportunities} open</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onFocus} aria-pressed={focused} aria-label={focused ? `Remove ${a.title} from priorities` : `Mark ${a.title} as a priority`} title={focused ? "Remove from priorities" : "This matters to me"} className="rounded-md p-1.5 text-ink3 hover:bg-white/5 hover:text-ink">
            <Star className={`size-4 ${focused ? "fill-cyan text-cyan" : ""}`} />
          </button>
          <button type="button" onClick={onHide} aria-label={`Hide ${a.title}`} title="Not for me" className="rounded-md p-1.5 text-ink3 hover:bg-white/5 hover:text-ink">
            <EyeOff className="size-4" />
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink2">{a.position}</p>

      <div className="panel-inner mt-3 p-3">
        <p className="text-xs text-ink3">{a.impact.label}</p>
        {a.impact.cents !== null && <p className={`num mt-0.5 font-display text-xl font-semibold ${IMPACT_TONE[a.impact.kind]}`}>{money(a.impact.cents)}</p>}
        <p className="mt-1 flex gap-1 text-[11px] text-ink3">
          <Info className="mt-0.5 size-3 shrink-0" /> {a.impact.basis}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-ink3">Effort</dt>
          <dd className="text-ink">{LEVEL[a.effort]}</dd>
        </div>
        <div title={a.confidenceBasis}>
          <dt className="text-ink3">Confidence</dt>
          <dd className="text-ink">{LEVEL[a.confidence]}</dd>
        </div>
        <div>
          <dt className="text-ink3">Benefit</dt>
          <dd className="text-ink">{a.timeToBenefit}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[11px] text-ink3">Confidence: {a.confidenceBasis}</p>

      {a.dependencies.length > 0 && (
        <div className="mt-3 text-xs">
          <p className="text-ink3">Needs</p>
          <ul className="mt-0.5 list-disc pl-4 text-ink2">
            {a.dependencies.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <Link href={a.nextStep.href} className="inline-flex items-center gap-1 text-sm font-medium text-cyan hover:underline">
          {a.nextStep.label} <ArrowRight className="size-3.5" />
        </Link>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink3">
          <input type="checkbox" checked={comparing} onChange={onCompare} className="accent-cyan" /> Compare
        </label>
      </div>
    </section>
  );
}
