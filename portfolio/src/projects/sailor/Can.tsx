import "@fontsource/dm-serif-display/400.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/800.css";
import type { Flavour } from "./data";

/** Fruit / spring illustrations used on the can labels. Simple, flat, printable shapes. */
export function Motif({ kind, color, ink }: { kind: Flavour["motif"]; color: string; ink: string }) {
  switch (kind) {
    case "grapefruit":
      return (
        <g>
          <circle r="22" fill={ink} />
          <circle r="19" fill={color} />
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1="0" y1="0" x2={18 * Math.cos((i * Math.PI) / 5)} y2={18 * Math.sin((i * Math.PI) / 5)} stroke={ink} strokeWidth="1.4" />
          ))}
          <circle r="3" fill={ink} />
        </g>
      );
    case "lemon":
      return (
        <g>
          <path d="M-24 0 Q-20 -16 0 -17 Q20 -16 24 0 Q20 16 0 17 Q-20 16 -24 0Z" fill={ink} />
          <path d="M-20 0 Q-17 -13 0 -14 Q17 -13 20 0 Q17 13 0 14 Q-17 13 -20 0Z" fill={color} />
          <path d="M6 -16 q8 -10 18 -8 q-6 8 -18 8z" fill={ink} />
        </g>
      );
    case "plum":
      return (
        <g>
          <circle cx="-7" cy="4" r="15" fill={ink} />
          <circle cx="9" cy="6" r="13" fill={color} stroke={ink} strokeWidth="2" />
          <path d="M2 -10 q10 -14 22 -12 q-6 12 -22 12z" fill={color} stroke={ink} strokeWidth="1.5" />
          <path d="M2 -10 L-2 -20" stroke={ink} strokeWidth="2" />
        </g>
      );
    case "cucumber":
      return (
        <g>
          <circle r="22" fill={ink} />
          <circle r="18" fill={color} />
          <circle r="11" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="2 3" />
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse key={i} cx={7 * Math.cos((i * Math.PI) / 3)} cy={7 * Math.sin((i * Math.PI) / 3)} rx="1.6" ry="3" fill={ink} transform={`rotate(${i * 60} ${7 * Math.cos((i * Math.PI) / 3)} ${7 * Math.sin((i * Math.PI) / 3)})`} />
          ))}
        </g>
      );
    case "peach":
      return (
        <g>
          <circle r="20" fill={color} stroke={ink} strokeWidth="2.4" />
          <path d="M0 -20 Q-7 0 0 20" fill="none" stroke={ink} strokeWidth="1.6" />
          <path d="M0 -20 q12 -12 24 -6 q-10 10 -24 6z" fill={ink} />
        </g>
      );
    case "spring":
    default:
      return (
        <g fill="none" stroke={ink} strokeWidth="1.6">
          <ellipse rx="24" ry="8" />
          <ellipse rx="15" ry="5" />
          <ellipse rx="6" ry="2" />
          <circle cx="-4" cy="-14" r="2.5" />
          <circle cx="5" cy="-22" r="1.8" />
          <circle cx="-1" cy="-30" r="1.2" />
        </g>
      );
  }
}

interface CanProps {
  flavour: Flavour;
  className?: string;
  /** Shown on the can as an accessible name; decorative if omitted. */
  title?: string;
}

/**
 * A slim 330 ml can drawn in SVG — label, metal rim, cylindrical shading and a
 * specular stripe, so it reads as an object rather than a flat card.
 */
export function Can({ flavour, className, title }: CanProps) {
  const w = flavour.weather;
  const id = flavour.id;
  const words = flavour.name.split(" ");
  return (
    <svg
      className={className}
      viewBox="0 0 120 290"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`shade-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".42" />
          <stop offset=".12" stopColor="#000" stopOpacity=".12" />
          <stop offset=".3" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".38" stopColor="#fff" stopOpacity=".05" />
          <stop offset=".75" stopColor="#000" stopOpacity=".05" />
          <stop offset="1" stopColor="#000" stopOpacity=".45" />
        </linearGradient>
        <linearGradient id={`metal-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#8d9096" />
          <stop offset=".3" stopColor="#f2f3f5" />
          <stop offset=".55" stopColor="#b5b8be" />
          <stop offset="1" stopColor="#6f7278" />
        </linearGradient>
        <clipPath id={`body-${id}`}>
          <path d="M8 26 Q8 18 16 16 L104 16 Q112 18 112 26 L112 268 Q112 278 100 280 L20 280 Q8 278 8 268Z" />
        </clipPath>
      </defs>
      {/* shadow on the surface it stands on */}
      <ellipse cx="60" cy="284" rx="56" ry="5" fill="#000" opacity=".18" />
      {/* lid */}
      <path d="M14 18 Q14 6 60 6 Q106 6 106 18Z" fill={`url(#metal-${id})`} />
      <ellipse cx="60" cy="10" rx="40" ry="3" fill="#d9dbdf" opacity=".8" />
      <g clipPath={`url(#body-${id})`}>
        <rect x="0" y="10" width="120" height="280" fill={w.label} />
        {/* top band with the wordmark */}
        <rect x="0" y="16" width="120" height="34" fill={w.band} />
        <text x="60" y="38" textAnchor="middle" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="800" fontSize="9.5" letterSpacing="0.6" fill={w.label}>
          SAILOR SPRINGS
        </text>
        {/* the sun the motif sits in */}
        <circle cx="60" cy="98" r="34" fill={w.sun} />
        <g transform="translate(60 98)">
          <Motif kind={flavour.motif} color={w.label} ink={w.labelInk} />
        </g>
        {/* coast-road horizon */}
        <path d="M0 134 Q30 126 60 132 T120 128" stroke={w.labelInk} strokeWidth="1.2" fill="none" opacity=".6" />
        {words.map((word, i) => (
          <text
            key={word + i}
            x="60"
            y={170 + i * 30}
            textAnchor="middle"
            fontFamily="'DM Serif Display', serif"
            fontSize={word.length > 8 ? 19 : word.length > 6 ? 24 : 30}
            fill={w.labelInk}
          >
            {word}
          </text>
        ))}
        <text x="60" y="244" textAnchor="middle" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="600" fontSize="6" fill={w.labelInk} opacity=".85">
          SPARKLING BOTANICAL WATER
        </text>
        <rect x="38" y="252" width="44" height="12" rx="6" fill="none" stroke={w.labelInk} strokeWidth="1" />
        <text x="60" y="261" textAnchor="middle" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="600" fontSize="7" fill={w.labelInk}>
          MILE {flavour.mile}
        </text>
        {/* cylindrical shading over everything */}
        <rect x="0" y="10" width="120" height="280" fill={`url(#shade-${id})`} />
      </g>
      {/* bottom rim */}
      <path d="M10 270 Q10 282 22 284 L98 284 Q110 282 110 270 L110 276 Q108 286 60 287 Q12 286 10 276Z" fill={`url(#metal-${id})`} />
    </svg>
  );
}
