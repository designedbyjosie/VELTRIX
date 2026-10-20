import { useLayoutEffect, useRef, useState } from "react";
import { href } from "../../lib/router";
import { flavours } from "./data";
import { base, useShop } from "./SailorSprings";
import { Can } from "./Can";

const ROAD = "M20 150 C120 40 220 230 330 130 S520 30 610 120 S800 220 880 90 S1010 40 1060 110";

/**
 * The range as a map: a hand-drawn coast road with a marker at each flavour's
 * mile. Selecting a stop drives the little van there and repaints the shop.
 */
export function CoastRoad() {
  const { flavour, setFlavour } = useShop();
  const pathRef = useRef<SVGPathElement>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);

  useLayoutEffect(() => {
    const p = pathRef.current;
    if (!p || typeof p.getTotalLength !== "function") return;
    const len = p.getTotalLength();
    setPoints(
      flavours.map((f) => {
        const pt = p.getPointAtLength((f.mile / 37) * len);
        return { x: pt.x, y: pt.y };
      }),
    );
  }, []);

  const active = flavours.findIndex((f) => f.id === flavour.id);
  const van = points[active];

  return (
    <div className="ss-road">
      <svg className="ss-road__map" viewBox="0 0 1080 260" role="img" aria-label="Map of the coast road with six flavour stops">
        <path d="M0 260 V200 C200 230 400 180 600 220 S900 190 1080 210 V260Z" fill="var(--ss-sea)" opacity=".6" />
        <path d={ROAD} fill="none" stroke="var(--ss-ink)" strokeOpacity=".18" strokeWidth="22" strokeLinecap="round" />
        <path ref={pathRef} d={ROAD} fill="none" stroke="var(--ss-ink)" strokeWidth="2" strokeDasharray="12 10" />
        {points.map((pt, i) => (
          <g key={flavours[i].id} transform={`translate(${pt.x} ${pt.y})`}>
            <circle r={i === active ? 15 : 10} fill={flavours[i].weather.label} stroke="var(--ss-ink)" strokeWidth="2" />
            <text y="-24" textAnchor="middle" className="ss-road__mile">
              {flavours[i].mile}
            </text>
          </g>
        ))}
        {van && (
          <g className="ss-road__van" style={{ transform: `translate(${van.x}px, ${van.y - 4}px)` }}>
            <rect x="-16" y="-34" width="32" height="18" rx="5" fill="var(--ss-accent)" />
            <rect x="-10" y="-30" width="9" height="7" rx="1.5" fill="var(--ss-sky)" />
            <rect x="2" y="-30" width="9" height="7" rx="1.5" fill="var(--ss-sky)" />
            <circle cx="-9" cy="-15" r="3.5" fill="var(--ss-ink)" />
            <circle cx="9" cy="-15" r="3.5" fill="var(--ss-ink)" />
          </g>
        )}
      </svg>

      <ol className="ss-road__stops">
        {flavours.map((f) => (
          <li key={f.id}>
            <button
              className="ss-stop"
              aria-pressed={f.id === flavour.id}
              onClick={() => setFlavour(f.id)}
              style={{ "--stop": f.weather.label, "--stop-ink": f.weather.labelInk } as React.CSSProperties}
            >
              <span className="ss-stop__mile">Mile {f.mile}</span>
              <span className="ss-stop__place">{f.place}</span>
              <Can flavour={f} className="ss-stop__can" />
              <span className="ss-stop__name">{f.name}</span>
              <span className="ss-stop__line">{f.line}</span>
            </button>
            <a className="ss-stop__more" href={href(`${base}/shop/${f.id}`)}>
              View {f.name}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
