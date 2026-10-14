import type { ReactNode } from "react";

export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 56) / 64} viewBox="0 0 64 56" aria-hidden="true">
      <defs>
        <linearGradient id="xa" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stopColor="#7FE7FF" /><stop offset="1" stopColor="#2878FF" /></linearGradient>
        <linearGradient id="xb" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stopColor="#2878FF" /><stop offset="1" stopColor="#1B3C9E" /></linearGradient>
        <linearGradient id="xc" x1="1" y1="0" x2="0.7" y2="1"><stop offset="0" stopColor="#6A4CF0" /><stop offset="1" stopColor="#2C1E86" /></linearGradient>
        <linearGradient id="xd" x1="1" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#D2B8FF" /><stop offset="1" stopColor="#7954FF" /></linearGradient>
      </defs>
      <polygon points="2,4 15,4 32,54" fill="url(#xa)" />
      <polygon points="15,4 23,4 32,29 32,54" fill="url(#xb)" />
      <polygon points="41,4 49,4 32,54 32,29" fill="url(#xc)" />
      <polygon points="49,4 62,4 32,54" fill="url(#xd)" />
    </svg>
  );
}

export function Badge({ tone = "neutral", children, title }: { tone?: "neutral" | "pos" | "warn" | "info" | "demo" | "neg"; children: ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Button({ variant = "secondary", children, ...rest }: { variant?: "primary" | "secondary" | "ghost" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn-${variant}`} {...rest}>
      {children}
    </button>
  );
}

export const money = (cents: number | null | undefined, currency: string | null = "USD") =>
  cents === null || cents === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(cents / 100);
