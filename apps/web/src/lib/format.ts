import { formatMoney, formatPercent } from "@veltrix/shared";

export const money = (cents: number | null | undefined, currency = "USD", opts?: Parameters<typeof formatMoney>[2]) =>
  cents === null || cents === undefined ? "—" : formatMoney(cents, currency, opts);
export const pct = formatPercent;

export function shortDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: iso.length === 10 ? "UTC" : undefined }).format(d);
}

export function monthLabel(ym: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-US", { month: style, year: style === "long" ? "numeric" : "2-digit", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return shortDate(iso, { month: "short", day: "numeric", year: "numeric" });
}

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
