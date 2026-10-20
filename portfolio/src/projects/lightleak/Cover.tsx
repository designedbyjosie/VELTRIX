import type { Track } from "./catalog";
import { hash } from "./recommend";

/**
 * Generated stand-in artwork. Real album covers aren't licensed for this demo,
 * so each track gets an abstract composition drawn from its id and tinted by
 * the photo's palette.
 */
export function Cover({ track, palette, size = 120 }: { track: Track; palette: string[]; size?: number }) {
  const h = (k: string) => hash(track.id + k);
  const cols = palette.length ? palette : ["#d8d2c6", "#2a2a2a", "#b0a99a"];
  const c = (k: string) => cols[Math.floor(h(k) * cols.length)];
  const kind = Math.floor(h("kind") * 4);
  const initials = track.title.replace(/[^A-Za-z0-9 ]/g, "").split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="ll-cover">
      <rect width="100" height="100" fill={c("bg")} />
      {kind === 0 && <circle cx={30 + h("x") * 40} cy={30 + h("y") * 40} r={18 + h("r") * 22} fill={c("a")} />}
      {kind === 1 &&
        [0, 1, 2, 3, 4].map((i) => <rect key={i} x="0" y={i * 20 + h("o") * 8} width="100" height={6 + h("w" + i) * 8} fill={c("s" + i)} />)}
      {kind === 2 && <path d={`M0 ${60 + h("a") * 20} Q50 ${h("b") * 60} 100 ${50 + h("c") * 30} V100 H0Z`} fill={c("w")} />}
      {kind === 3 && (
        <g>
          <rect x={10 + h("x") * 20} y={10 + h("y") * 20} width="50" height="50" fill={c("q")} transform={`rotate(${h("rot") * 30 - 15} 50 50)`} />
          <circle cx="70" cy="70" r="14" fill={c("d")} />
        </g>
      )}
      <rect width="100" height="100" fill="url(#ll-grain)" opacity=".35" />
      <text x="8" y="92" fontFamily="Anton, Impact, sans-serif" fontSize="16" fill="#fff" style={{ mixBlendMode: "difference" }}>
        {initials.toUpperCase()}
      </text>
    </svg>
  );
}

/** One shared grain pattern for every cover. */
export function GrainDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="ll-noise">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .6 0" />
        </filter>
        <pattern id="ll-grain" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" filter="url(#ll-noise)" />
        </pattern>
      </defs>
    </svg>
  );
}
