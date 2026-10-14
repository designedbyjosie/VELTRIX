"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { Segmented } from "@/components/ui";
import { useRouter } from "next/navigation";

export function ReportPeriod({ period }: { period: "monthly" | "yearly" }) {
  const router = useRouter();
  return (
    <Segmented
      label="Report period"
      value={period}
      onChange={(v) => router.push(`/app/reports?period=${v}`)}
      options={[
        { value: "monthly", label: "Monthly (12 months)" },
        { value: "yearly", label: "Yearly (3 years)" },
      ]}
    />
  );
}

export function DownloadReportCsv({ rows, filename }: { rows: { month: string; incomeCents: number; spendingCents: number; netCents: number; savingsRate: number | null }[]; filename: string }) {
  return (
    <button
      className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-panel-hi px-3 text-[13px] font-medium hover:border-blue/60"
      onClick={() => {
        const lines = ["Period,Income,Spending,Net,Savings rate %", ...rows.map((r) => [r.month, (r.incomeCents / 100).toFixed(2), (r.spendingCents / 100).toFixed(2), (r.netCents / 100).toFixed(2), r.savingsRate ?? ""].join(","))];
        const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="size-4" aria-hidden /> Report CSV
    </button>
  );
}

export function ExportLinks() {
  return (
    <>
      <Link href="/api/settings/export?format=csv" prefetch={false} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-panel-hi px-3 text-[13px] font-medium hover:border-blue/60">
        <Download className="size-4" aria-hidden /> All transactions
      </Link>
    </>
  );
}
