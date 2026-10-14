import { useId } from "react";

/** The VELTRIX prism mark: four faceted planes forming a V. */
export function VeltrixMark({ size = 32, glow = false, className = "" }: { size?: number; glow?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={(size * 56) / 64} viewBox="0 0 64 56" className={className} aria-hidden="true" style={glow ? { filter: "drop-shadow(0 0 18px rgba(57,217,255,.45)) drop-shadow(0 0 40px rgba(121,84,255,.35))" } : undefined}>
      <defs>
        <linearGradient id={`a${id}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#7FE7FF" />
          <stop offset="1" stopColor="#2878FF" />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#2878FF" />
          <stop offset="1" stopColor="#1B3C9E" />
        </linearGradient>
        <linearGradient id={`c${id}`} x1="1" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#6A4CF0" />
          <stop offset="1" stopColor="#2C1E86" />
        </linearGradient>
        <linearGradient id={`d${id}`} x1="1" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#D2B8FF" />
          <stop offset="1" stopColor="#7954FF" />
        </linearGradient>
      </defs>
      <polygon points="2,4 15,4 32,54" fill={`url(#a${id})`} />
      <polygon points="15,4 23,4 32,29 32,54" fill={`url(#b${id})`} />
      <polygon points="41,4 49,4 32,54 32,29" fill={`url(#c${id})`} />
      <polygon points="49,4 62,4 32,54" fill={`url(#d${id})`} />
      <polyline points="2,4 32,54 62,4" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="0.6" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`wordmark text-ink ${className}`}>VELTRIX</span>;
}

export function Logo({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <VeltrixMark size={size} />
      <Wordmark className="text-[15px]" />
      <span className="sr-only">VELTRIX</span>
    </span>
  );
}
