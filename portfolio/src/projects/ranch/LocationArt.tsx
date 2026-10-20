import type { LocationId } from "./data";

/** Poster-style illustrations for each place, drawn with a limited travel-poster palette. */
export function LocationArt({ id }: { id: LocationId }) {
  const cream = "#efe2c8";
  const brown = "#3b2418";
  const rust = "#a2472a";
  const ochre = "#c98e3b";
  const teal = "#5e9c97";
  return (
    <svg viewBox="0 0 300 220" className="cw-art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="300" height="220" fill={id === "campfire" ? "#1b2240" : "#e9c79a"} />
      <circle cx="220" cy={id === "overlook" ? 130 : 60} r="30" fill={id === "campfire" ? "#efe2c8" : "#f7e2b3"} />
      <path d="M0 150 L50 110 L90 130 L150 90 L210 125 L260 100 L300 120 V220 H0Z" fill={id === "campfire" ? "#2a2238" : ochre} opacity=".8" />
      <path d="M0 170 Q150 150 300 175 V220 H0Z" fill={id === "campfire" ? "#2b1d18" : rust} />
      {id === "gate" && (
        <g fill={brown}>
          <rect x="90" y="80" width="10" height="110" />
          <rect x="200" y="80" width="10" height="110" />
          <rect x="84" y="78" width="132" height="10" />
          <rect x="108" y="92" width="84" height="26" fill={cream} stroke={brown} strokeWidth="3" />
          <path d="M150 220 Q155 190 150 170" stroke={cream} strokeWidth="18" fill="none" />
        </g>
      )}
      {id === "house" && (
        <g>
          <rect x="70" y="110" width="160" height="66" fill="#c98e66" />
          <rect x="64" y="102" width="172" height="12" fill="#b57a55" />
          <rect x="70" y="140" width="160" height="6" fill={brown} />
          {[90, 140, 190].map((x) => (
            <rect key={x} x={x} y="122" width="16" height="18" fill={brown} />
          ))}
          <rect x="160" y="150" width="16" height="26" fill={teal} />
        </g>
      )}
      {id === "stables" && (
        <g>
          <rect x="80" y="110" width="140" height="66" fill={rust} />
          <path d="M70 112 L150 70 L230 112Z" fill={brown} />
          <rect x="130" y="130" width="40" height="46" fill={cream} />
          <path d="M130 130 L170 176 M170 130 L130 176" stroke={rust} strokeWidth="4" />
          {[20, 40, 240, 260, 280].map((x) => (
            <rect key={x} x={x} y="150" width="5" height="30" fill={brown} />
          ))}
          <rect x="15" y="158" width="275" height="4" fill={brown} />
        </g>
      )}
      {id === "trail" && (
        <g>
          <path d="M40 220 C80 180 160 190 170 150 S230 110 260 100" stroke={cream} strokeWidth="10" fill="none" strokeDasharray="14 8" />
          {[
            [60, 150],
            [110, 130],
            [210, 150],
            [250, 170],
            [30, 180],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect x="-2" y="0" width="4" height="16" fill={brown} />
              <circle r="14" fill="#56603a" />
            </g>
          ))}
        </g>
      )}
      {id === "windmill" && (
        <g stroke={brown} strokeWidth="4" fill="none">
          <path d="M120 190 L140 70 L160 190" />
          <path d="M126 150 L154 150 M130 120 L150 120" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1={140} y1={70} x2={140 + Math.cos(a) * 38} y2={70 + Math.sin(a) * 38} />;
          })}
          <ellipse cx="210" cy="180" rx="44" ry="10" fill={teal} />
        </g>
      )}
      {id === "campfire" && (
        <g>
          {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={(i * 97) % 300} cy={(i * 41) % 100} r="1.4" fill="#fff" />
          ))}
          <path d="M140 180 Q150 130 160 180Z" fill="#ff9a3c" />
          <path d="M146 180 Q152 150 156 180Z" fill="#ffe08a" />
          <rect x="120" y="178" width="60" height="6" fill={brown} transform="rotate(8 150 181)" />
          <rect x="120" y="178" width="60" height="6" fill={brown} transform="rotate(-8 150 181)" />
          <circle cx="150" cy="170" r="60" fill="#ff9a3c" opacity=".15" />
        </g>
      )}
      {id === "overlook" && (
        <g>
          <path d="M60 220 L80 120 L220 120 L240 220Z" fill={rust} />
          <path d="M80 120 L220 120 L215 132 L85 132Z" fill={brown} />
          <g fill={brown}>
            <circle cx="150" cy="104" r="5" />
            <rect x="146" y="108" width="8" height="12" />
          </g>
        </g>
      )}
      {id === "store" && (
        <g>
          <rect x="90" y="80" width="120" height="100" fill={cream} stroke={brown} strokeWidth="3" />
          <rect x="100" y="90" width="100" height="22" fill={teal} />
          <text x="150" y="106" textAnchor="middle" fontFamily="'Alfa Slab One', serif" fontSize="13" fill={cream}>
            GEN. STORE
          </text>
          <rect x="135" y="135" width="30" height="45" fill={brown} />
          <rect x="100" y="130" width="25" height="22" fill={brown} opacity=".7" />
          <rect x="175" y="130" width="25" height="22" fill={brown} opacity=".7" />
          <rect x="80" y="176" width="140" height="8" fill="#6b4a33" />
        </g>
      )}
    </svg>
  );
}
