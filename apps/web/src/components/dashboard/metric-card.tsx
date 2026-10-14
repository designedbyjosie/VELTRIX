import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Delta, Sparkline } from "@/components/ui-sparkline";

export function MetricCard({ label, value, change, goodWhen = "up", comparison, href, spark, sparkColor, note }: { label: string; value: string; change: number | null; goodWhen?: "up" | "down" | "neutral"; comparison: string; href: string; spark?: number[]; sparkColor?: string; note?: string }) {
  return (
    <Link href={href} className="panel group block p-4 transition hover:border-blue/60">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink2">{label}</p>
        <ArrowRight className="size-4 text-ink3 opacity-0 transition group-hover:opacity-100" aria-hidden />
      </div>
      <p className="num mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-tight text-ink">{value}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="flex flex-wrap items-center gap-1 text-xs text-ink3">
          <Delta value={change} goodWhen={goodWhen} /> <span>{comparison}</span>
        </p>
        {spark && spark.length > 1 && (
          <div className="w-20 shrink-0">
            <Sparkline values={spark} color={sparkColor} height={28} />
          </div>
        )}
      </div>
      {note && <p className="mt-1 text-[11px] text-ink3">{note}</p>}
    </Link>
  );
}
