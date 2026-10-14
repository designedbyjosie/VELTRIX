import { ChartCandlestick, House, PiggyBank, Plane, ShoppingBag, Sparkles, Target } from "lucide-react";
import { VeltrixMark } from "@/components/logo";

/** Static illustration of the dashboard. Figures are sample values, labeled as such. */
export function DashboardPreview() {
  const nav = [House, ChartCandlestick, PiggyBank, Target, ShoppingBag, Plane, Sparkles];
  const slices = [
    { c: "#3B82F6", v: 34 },
    { c: "#D96A26", v: 18 },
    { c: "#1798BD", v: 12 },
    { c: "#D55181", v: 8 },
    { c: "#C98500", v: 7 },
    { c: "#8F72F0", v: 6 },
    { c: "#16A06C", v: 15 },
  ];
  let acc = 0;
  const arcs = slices.map((s) => {
    const start = (acc / 100) * Math.PI * 2;
    acc += s.v;
    const end = (acc / 100) * Math.PI * 2 - 0.04;
    const r = 34;
    const p = (a: number) => `${50 + r * Math.sin(a)} ${50 - r * Math.cos(a)}`;
    return <path key={s.c} d={`M ${p(start)} A ${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${p(end)}`} stroke={s.c} strokeWidth="11" fill="none" />;
  });
  return (
    <figure className="relative" aria-label="Illustrative preview of the VELTRIX dashboard with sample figures">
      <div className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(closest-side,rgba(40,120,255,.35),transparent)] blur-2xl" aria-hidden />
      <div className="relative overflow-hidden rounded-[20px] border border-blue/50 bg-bg/90 shadow-[0_0_60px_-10px_rgba(40,120,255,.55)]" aria-hidden>
        <div className="flex">
          <div className="hidden w-14 flex-col items-center gap-3 border-r border-line-soft py-4 sm:flex">
            <VeltrixMark size={20} />
            {nav.map((Icon, i) => (
              <span key={i} className={`grid size-8 place-items-center rounded-[8px] ${i === 0 ? "brand-gradient text-white" : "text-ink3"}`}>
                <Icon className="size-4" />
              </span>
            ))}
          </div>
          <div className="flex-1 space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[15px] font-semibold">Good morning, Alex.</p>
                <p className="text-[10px] text-ink3">Here&apos;s your financial overview.</p>
              </div>
              <div className="glass hidden rounded-[10px] px-3 py-2 sm:block">
                <p className="text-[9px] text-cyan">AI Advisor</p>
                <p className="text-[10px]">Review 4 subscriptions</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                ["Net worth", "$124,563", "+12.4%"],
                ["Monthly spending", "$3,248", "−8.2%"],
                ["Savings", "$18,420", "+15.6%"],
                ["Investments", "$56,730", "+16.9%"],
              ].map(([l, v, d]) => (
                <div key={l} className="rounded-[10px] border border-line-soft bg-panel p-2.5">
                  <p className="text-[9px] text-ink3">{l}</p>
                  <p className="num font-display text-[13px] font-semibold">{v}</p>
                  <p className="num text-[9px] text-pos">{d}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-[10px] border border-line-soft bg-panel p-3">
                <svg viewBox="0 0 100 100" className="size-20 shrink-0">{arcs}</svg>
                <div className="flex-1 space-y-1">
                  {["Housing", "Food & Dining", "Shopping", "Transport"].map((n, i) => (
                    <div key={n} className="flex items-center gap-1.5 text-[9px] text-ink2">
                      <span className="size-1.5 rounded-sm" style={{ background: slices[i].c }} /> {n}
                      <span className="num ml-auto text-ink">{slices[i].v}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[10px] border border-line-soft bg-panel p-3">
                <p className="text-[9px] text-ink3">Investment performance</p>
                <p className="num font-display text-[15px] font-semibold text-pos">+14.2%</p>
                <svg viewBox="0 0 200 50" className="mt-1 h-12 w-full">
                  <defs>
                    <linearGradient id="pv" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#26D9A0" stopOpacity=".4" />
                      <stop offset="1" stopColor="#26D9A0" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 42 L20 38 L40 40 L60 31 L80 33 L100 25 L120 27 L140 18 L160 20 L180 10 L200 6 L200 50 L0 50 Z" fill="url(#pv)" />
                  <path d="M0 42 L20 38 L40 40 L60 31 L80 33 L100 25 L120 27 L140 18 L160 20 L180 10 L200 6" fill="none" stroke="#26D9A0" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[11px] text-ink3">Illustrative preview with sample figures.</figcaption>
    </figure>
  );
}

export function ExtensionPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-[340px]" aria-label="Illustrative preview of the VELTRIX browser extension">
      <div className="absolute -inset-8 rounded-[32px] bg-[radial-gradient(closest-side,rgba(121,84,255,.35),transparent)] blur-2xl" aria-hidden />
      <div className="glass relative rounded-[18px] p-4 shadow-2xl" aria-hidden>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <VeltrixMark size={18} />
            <span className="wordmark text-[11px]">VELTRIX</span>
          </span>
          <span className="rounded-full border border-blue/40 bg-blue/10 px-2 py-0.5 text-[9px] text-[#8DB6FF]">Product page</span>
        </div>
        <div className="mt-3 flex gap-3 rounded-[12px] border border-line-soft bg-panel p-3">
          <div className="grid size-14 place-items-center rounded-[10px] bg-white/90 text-bg">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
              <rect x="3" y="14" width="4" height="6" rx="1.5" />
              <rect x="17" y="14" width="4" height="6" rx="1.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium">Wireless noise-cancelling headphones</p>
            <p className="num font-display text-base font-semibold">$348.00</p>
            <p className="text-[9px] text-pos">Lowest price you&apos;ve recorded</p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-[10px] text-ink2">
          <li>• Fits your Shopping budget: $52 would remain</li>
          <li>• You saw it for $369.99 at another store</li>
          <li>• Equal to 6% of what&apos;s left for your vacation goal</li>
        </ul>
        <div className="brand-gradient mt-3 rounded-[10px] py-2 text-center text-[11px] font-medium text-white">Save to wishlist</div>
      </div>
      <figcaption className="mt-3 text-center text-[11px] text-ink3">Illustrative preview with sample figures.</figcaption>
    </figure>
  );
}
