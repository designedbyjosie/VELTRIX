import { useEffect, useRef, useState, type ReactNode } from "react";
import { asset } from "../../lib/asset";
import { Reveal, SplitWords, useScrollProgress } from "../../lib/scroll";
import type { TimeOfDay } from "./scene3d";
import { navItems, go } from "./Bar";

/** Poster-style section head: numbered kicker, word-by-word title, optional lede. */
export function SectionHead({ num, kicker, title, lede, id, light = false, children }: { num: string; kicker: string; title: string; lede?: ReactNode; id?: string; light?: boolean; children?: ReactNode }) {
  return (
    <header className={`cw-head ${light ? "cw-head--light" : ""}`}>
      <Reveal as="p" kind="fade" className="cw-kicker">
        <span className="cw-kicker__num">No. {num}</span>
        <span className="cw-kicker__rule" aria-hidden="true" />
        <span>{kicker}</span>
      </Reveal>
      <h2 className="cw-h" id={id}>
        <SplitWords text={title} stagger={70} />
      </h2>
      {lede && (
        <Reveal as="p" className="cw-lede" delay={240}>
          {lede}
        </Reveal>
      )}
      {children}
    </header>
  );
}

/* ------------------------------------------------------------------ */
const chapters = [
  { n: "30", unit: "miles", title: "of dirt road", body: "The county road gives out at Hatch Junction. From there it's washboard, two crossings of Copper Wash, and cattle with right of way." },
  { n: "14", unit: "horses", title: "one for every rider", body: "Biscuit and June take the nervous ones. Rosco takes nobody's nonsense. The wranglers make the match on your first morning." },
  { n: "09", unit: "rooms", title: "under one adobe roof", body: "Thick walls that hold the day's heat into the night, quilts on every bed, and one long table where supper is shared." },
  { n: "∞", unit: "stars", title: "all the way down", body: "No town glow for sixty miles. When the fire burns low the sky comes right down to the mesa line." },
];

/**
 * The pinned interlude after the hero: four numbers that introduce the ranch
 * while the sun sets behind the mesas as you scroll.
 */
export function SunsetChapters({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, "track");
  const active = Math.min(chapters.length - 1, Math.floor(p * chapters.length * 0.999 + 0.0001));
  if (reduced) {
    return (
      <section className="cw-sunset is-static" aria-label="Copper Wells in four numbers" style={{ "--p": 0.55 } as React.CSSProperties}>
        <SunsetScenery />
        <ol className="cw-sunset__static">
          {chapters.map((c) => (
            <li key={c.unit}>
              <span className={`cw-sunset__num ${c.n === "∞" ? "cw-sunset__num--inf" : ""}`} aria-hidden="true">
                {c.n}
              </span>
              <span className="cw-sunset__unit">
                {c.n === "∞" ? "Countless" : Number(c.n)} {c.unit}
              </span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <section className="cw-sunset" id="cw-intro" ref={ref} aria-label="Copper Wells in four numbers" style={{ "--p": p.toFixed(4) } as React.CSSProperties}>
      <div className="cw-sunset__stage">
        <SunsetScenery />
        <div className="cw-sunset__copy">
          <p className="cw-sunset__kicker">The last thirty miles</p>
          <ol className="cw-sunset__list">
            {chapters.map((c, i) => (
              <li key={c.unit} className={i === active ? "is-on" : i < active ? "is-past" : ""}>
                <span className={`cw-sunset__num ${c.n === "∞" ? "cw-sunset__num--inf" : ""}`} aria-hidden="true">
                  {c.n}
                </span>
                <div className="cw-sunset__text">
                  <span className="cw-sunset__unit">
                    {c.n === "∞" ? "Countless" : Number(c.n)} {c.unit}
                  </span>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ol className="cw-sunset__dots" aria-hidden="true">
            {chapters.map((c, i) => (
              <li key={c.unit} className={i === active ? "is-on" : ""}>
                {["I", "II", "III", "IV"][i]}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function SunsetScenery() {
  return (
    <div className="cw-sunset__scene" aria-hidden="true">
      <div className="cw-sunset__sky" />
      <div className="cw-sunset__stars" />
      <div className="cw-sunset__sun" />
      <svg className="cw-sunset__far" viewBox="0 0 1600 400" preserveAspectRatio="none">
        <path d="M0 260 L140 260 L170 170 L420 170 L455 260 L760 260 L790 205 L980 205 L1010 260 L1240 260 L1280 140 L1520 140 L1560 260 L1600 260 V400 H0Z" />
      </svg>
      <svg className="cw-sunset__mid" viewBox="0 0 1600 400" preserveAspectRatio="none">
        <path d="M0 300 Q260 250 540 290 T1100 280 T1600 300 V400 H0Z" />
      </svg>
      <svg className="cw-sunset__near" viewBox="0 0 1600 400" preserveAspectRatio="none">
        <path d="M0 340 Q420 300 820 335 T1600 325 V400 H0Z" />
        {/* windmill and a rider on the ridge */}
        <g transform="translate(1180 228)" strokeWidth="5" stroke="currentColor" fill="none">
          <path d="M14 104 L30 10 L46 104 M20 70 H40" />
          <g className="cw-sunset__blades">
            {Array.from({ length: 8 }, (_, i) => (
              <path key={i} d="M30 10 L30 -18" transform={`rotate(${i * 45} 30 10)`} />
            ))}
          </g>
        </g>
        <g transform="translate(330 262)" fill="currentColor">
          <path d="M0 40 Q6 22 26 20 L48 20 Q58 6 66 8 L64 18 Q70 26 62 30 L56 26 L50 40 L46 62 L42 62 L42 42 L16 42 L12 62 L8 62 L8 42Z" />
          <path d="M26 20 L30 -4 L40 -4 L40 20Z" />
          <circle cx="35" cy="-10" r="6" />
          <path d="M26 -16 H44 L40 -20 H30Z" />
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
const lights: { t: TimeOfDay; label: string; clock: string; title: string; body: string }[] = [
  { t: "dawn", label: "Dawn", clock: "5:52 am", title: "Coffee on the porch", body: "Frost on the trough, the wranglers saddling up, and the mesas going from grey to rose in about four minutes." },
  { t: "day", label: "Midday", clock: "12:40 pm", title: "The long white noon", body: "Shade is currency. Horses doze in the corral, the store sells out of lemonade, and the wash shimmers." },
  { t: "dusk", label: "Dusk", clock: "7:18 pm", title: "Copper hour", body: "The light the ranch is named for. Everything west of the house turns the colour of a new penny." },
  { t: "night", label: "Night", clock: "10:05 pm", title: "Lamps and a low fire", body: "Nine windows lit, one guitar, and more stars than anyone at the circle can name." },
];

/**
 * A pinned, horizontally travelling gallery of the 3D ranch at four times of day.
 * On small screens and with reduced motion it becomes a native scroll-snap row.
 */
export function FourLights({ reduced, onSee }: { reduced: boolean; onSee: (t: TimeOfDay) => void }) {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  const [dist, setDist] = useState(0);
  const p = useScrollProgress(ref, "track");
  const pinned = wide && !reduced;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (!pinned) return;
    const measure = () => track.current && setDist(Math.max(0, track.current.scrollWidth - window.innerWidth));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pinned]);

  return (
    <section
      className={`cw-lights ${pinned ? "is-pinned" : ""}`}
      id="cw-lights"
      ref={ref}
      aria-labelledby="cw-lights-title"
      style={pinned ? ({ height: `calc(100vh + ${dist}px)` } as React.CSSProperties) : undefined}
    >
      <div className="cw-lights__stage">
        <ol className="cw-lights__track" ref={track} style={pinned ? { transform: `translate3d(${-p * dist}px,0,0)` } : undefined}>
          <li className="cw-lights__intro">
            <SectionHead num="04" kicker="Rendered live in the hero" title="Four lights on one ranch" id="cw-lights-title" light lede="The same gate, the same road, four times a day. These are frames from the 3D ranch above — pick one to see it live." />
            <p className="cw-lights__hint" aria-hidden="true">
              {pinned ? "Keep scrolling" : "Swipe through the day"} <span>→</span>
            </p>
          </li>
          {lights.map((l, i) => (
            <li key={l.t} className="cw-light">
              <figure>
                <div className="cw-light__frame">
                  <img src={asset(`img/ranch/ranch-gate-${l.t}.jpg`)} width={1600} height={1000} loading="lazy" decoding="async" alt={`The Copper Wells gate and road at ${l.label.toLowerCase()}, rendered from the 3D scene`} />
                  <span className="cw-light__stamp" aria-hidden="true">
                    {l.label}
                  </span>
                </div>
                <figcaption>
                  <span className="cw-light__meta">
                    <span>{String(i + 1).padStart(2, "0")} / 04</span>
                    <span>{l.clock}</span>
                  </span>
                  <span className="cw-light__title">{l.title}</span>
                  <span className="cw-light__body">{l.body}</span>
                </figcaption>
              </figure>
              <button className="cw-btn cw-btn--small" onClick={() => onSee(l.t)}>
                See it live at {l.label.toLowerCase()}
              </button>
            </li>
          ))}
        </ol>
        {pinned && (
          <div className="cw-lights__meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${p})` }} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function Footer({ reduced, onPlan, onGate }: { reduced: boolean; onPlan: () => void; onGate: () => void }) {
  return (
    <footer className="cw-foot" id="cw-end">
      <div className="cw-foot__sky" aria-hidden="true">
        <span className="cw-foot__sun" />
        <svg viewBox="0 0 1600 260" preserveAspectRatio="none">
          <path d="M0 170 L180 170 L215 90 L470 90 L505 170 L860 170 L890 120 L1080 120 L1110 170 L1290 170 L1330 60 L1540 60 L1580 170 L1600 170 V260 H0Z" fill="#6e2f1f" />
          <path d="M0 215 Q400 180 800 210 T1600 200 V260 H0Z" fill="#3b2418" />
        </svg>
      </div>
      <div className="cw-foot__inner">
        <div className="cw-foot__lead">
          <Reveal as="p" kind="fade" className="cw-kicker cw-kicker--light">
            <span className="cw-kicker__num">No. 10</span>
            <span className="cw-kicker__rule" aria-hidden="true" />
            <span>Until next time</span>
          </Reveal>
          <p className="cw-foot__big">
            <SplitWords text="See you" />
            <br />
            <SplitWords text="at the gate." delay={180} />
          </p>
          <div className="cw-foot__ctas">
            <button className="cw-btn" onClick={onPlan}>
              Plan a visit (demo)
            </button>
            <button className="cw-btn cw-btn--line" onClick={onGate}>
              Ride in again
            </button>
          </div>
        </div>
        <nav className="cw-foot__nav" aria-label="Footer">
          <p className="cw-foot__label">The ranch</p>
          <ul>
            {navItems.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} onClick={(e) => (e.preventDefault(), go(id, !reduced))}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="cw-foot__card">
          <p className="cw-foot__label">Postmarked</p>
          <p className="cw-foot__addr">
            Copper Wells Ranch
            <br />
            County Road 9, Vara Valley
            <br />
            Elevation 5,840 ft
          </p>
          <span className="cw-foot__stamp" aria-hidden="true">
            <span>Vara</span>
            <span>Valley</span>
            <span>1891</span>
          </span>
        </div>
      </div>
      <div className="cw-foot__base">
        <p className="cw-foot__mark" aria-hidden="true">
          Copper Wells
        </p>
        <p className="cw-foot__fine">
          A fictional destination designed as a self-initiated portfolio concept. The ranch, the valley, its history and its people are
          invented. No bookings or enquiries are processed. Landscape renders are frames from this page's own 3D scene.
        </p>
      </div>
    </footer>
  );
}
