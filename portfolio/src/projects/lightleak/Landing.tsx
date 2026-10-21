import { useEffect, useRef, useState } from "react";
import { Reveal, SplitWords, useParallax, useScrollProgress, useScrolled } from "../../lib/scroll";
import { prefersReducedMotion, useReducedMotion } from "../../lib/motion";
import { analyzeImage, topMoods, type Analysis, type Mood, type MoodWeights } from "./analyze";
import { demoPhotos, renderDemoPhoto, type DemoPhoto } from "./demoPhotos";
import { defaultDirection, playlistName, recommend, type Scored } from "./recommend";
import { energyFromAnalysis, moodsFromAnalysis } from "./seed";
import { Cover } from "./Cover";
import type { Photo } from "./Lightleak";

/* ------------------------------------------------------------------ */
/* Real readings of the demo photos, computed in the browser.          */
/* Everything the landing page shows about them is genuine output of   */
/* the same analysis + recommendation code the app uses.               */
/* ------------------------------------------------------------------ */
interface Reading {
  demo: DemoPhoto;
  src: string;
  analysis: Analysis;
  moods: MoodWeights;
  name: string;
  tracks: Scored[];
}

function useReadings() {
  const [readings, setReadings] = useState<Reading[]>([]);
  useEffect(() => {
    let alive = true;
    // Paint after first frame so the page appears immediately.
    const t = setTimeout(async () => {
      const out: Reading[] = [];
      for (const demo of demoPhotos) {
        const src = renderDemoPhoto(demo);
        const img = new Image();
        img.src = src;
        try {
          await img.decode();
        } catch {
          continue;
        }
        const analysis = analyzeImage(img);
        const moods = moodsFromAnalysis(analysis);
        const direction = { ...defaultDirection, energy: energyFromAnalysis(analysis) };
        out.push({ demo, src, analysis, moods, name: playlistName(moods, analysis.palette, demo.title), tracks: recommend(moods, direction, demo.title).tracks });
        if (!alive) return;
        setReadings([...out]);
      }
    }, 30);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);
  return readings;
}

const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });

/** Film edge printing — the little codes along the rebate of a negative. */
function EdgePrint({ from = 1, count = 14, label = "LIGHTLEAK 400" }: { from?: number; count?: number; label?: string }) {
  return (
    <div className="lle-edge" aria-hidden="true">
      <div className="lle-edge__holes" />
      <div className="lle-edge__codes">
        {Array.from({ length: count }, (_, i) => (
          <span key={i}>
            {i % 4 === 0 && <b>{label}</b>}
            <span>▸ {from + i}</span>
            <span>{from + i}A</span>
          </span>
        ))}
      </div>
      <div className="lle-edge__holes" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function Welcome({
  onStart,
  savedCount,
  onLibrary,
  onDemo,
}: {
  onStart: () => void;
  savedCount: number;
  onLibrary: () => void;
  onDemo: (p: Photo, a: Analysis) => void;
}) {
  const readings = useReadings();
  const open = (r: Reading) => onDemo({ src: r.src, name: r.demo.title, demo: true }, r.analysis);
  return (
    <div className="lle">
      <span className="lle-grain" aria-hidden="true" />
      <TopBar onStart={onStart} savedCount={savedCount} onLibrary={onLibrary} />
      <Hero readings={readings} onStart={onStart} savedCount={savedCount} onLibrary={onLibrary} />
      <Manifesto />
      <Development reading={readings[0]} />
      <ContactSheet readings={readings} onOpen={open} />
      <HouseRules />
      <Footer onStart={onStart} savedCount={savedCount} onLibrary={onLibrary} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function TopBar({ onStart, savedCount, onLibrary }: { onStart: () => void; savedCount: number; onLibrary: () => void }) {
  const scrolled = useScrolled(60);
  return (
    <header className={`lle-bar ${scrolled ? "is-scrolled" : ""}`}>
      <p className="lle-bar__brand">
        Lightleak<sup>concept</sup>
      </p>
      <nav className="lle-bar__nav" aria-label="Lightleak sections">
        <button onClick={() => scrollToId("lle-develop")}>How it reads</button>
        <button onClick={() => scrollToId("lle-sheet")}>Contact sheet</button>
        <button onClick={() => scrollToId("lle-rules")}>House rules</button>
        {savedCount > 0 && <button onClick={onLibrary}>Saved ({savedCount})</button>}
      </nav>
      <button className="lle-btn lle-btn--small" onClick={onStart}>
        <span className="lle-btn__dot" aria-hidden="true" />
        Add a photo
      </button>
    </header>
  );
}

/* ------------------------------------------------------------------ */
function Hero({ readings, onStart, savedCount, onLibrary }: { readings: Reading[]; onStart: () => void; savedCount: number; onLibrary: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useParallax(ref);
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduced || paused || readings.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % readings.length), 3800);
    return () => clearInterval(t);
  }, [reduced, paused, readings.length]);
  const r = readings[i];

  return (
    <section className="lle-hero" ref={ref} aria-labelledby="lle-title">
      <div className="lle-hero__leak" aria-hidden="true" />
      <div className="lle-hero__safelight" aria-hidden="true" />
      <div className="lle-hero__copy">
        <Reveal as="p" kind="fade" className="lle-kicker">
          <span>A photo-to-playlist app</span>
          <span>Self-initiated concept</span>
        </Reveal>
        <h1 id="lle-title" className="lle-hero__title">
          <SplitWords text="What does this" className="lle-hero__line" stagger={70} />
          <SplitWords text="picture" className="lle-hero__line" delay={180} />
          <span className="lle-hero__line lle-hero__line--leak">
            <SplitWords text="sound like?" delay={320} stagger={90} />
          </span>
        </h1>
        <Reveal as="p" className="lle-hero__lede" delay={520}>
          Hand Lightleak a photo you want to post. It reads the colour and light right here in your browser, guesses a mood
          you're free to overrule, and develops a short playlist to go with it.
        </Reveal>
        <Reveal className="lle-hero__ctas" delay={660}>
          <button className="lle-btn" onClick={onStart}>
            <span className="lle-btn__dot" aria-hidden="true" />
            Add a photo
          </button>
          <button className="lle-btn lle-btn--ghost" onClick={() => scrollToId("lle-develop")}>
            Watch one develop
          </button>
          {savedCount > 0 && (
            <button className="lle-link" onClick={onLibrary}>
              Saved playlists ({savedCount})
            </button>
          )}
        </Reveal>
      </div>

      <div
        className="lle-hero__line-up"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <span className="lle-hero__wire" aria-hidden="true" />
        <div className="lle-hero__prints">
          {demoPhotos.map((d, n) => {
            const rd = readings.find((x) => x.demo.id === d.id);
            const pos = (n - i + demoPhotos.length) % demoPhotos.length;
            return (
              <figure key={d.id} className={`lle-print lle-print--${pos}`} aria-hidden={pos !== 0}>
                <span className="lle-print__clip" aria-hidden="true" />
                <span className="lle-print__img">{rd && <img src={rd.src} alt={pos === 0 ? `Demo photo, painted in the browser: ${d.title}` : ""} />}</span>
                <figcaption>{d.title}</figcaption>
              </figure>
            );
          })}
        </div>
        <div className="lle-hero__reading" aria-live="polite">
          <p className="lle-label">
            <span>Demo reading</span>
            <span>
              {String(i + 1).padStart(2, "0")} / {String(demoPhotos.length).padStart(2, "0")}
            </span>
          </p>
          <div className="lle-swatches" key={`sw-${i}`}>
            {(r?.analysis.palette ?? [0, 1, 2, 3, 4].map((k) => ({ hex: "#2a2220", share: 0.2, name: `swatch ${k}` }))).map((s) => (
              <i key={s.hex + s.name} style={{ background: s.hex, flexGrow: Math.max(0.5, s.share * 10) }} />
            ))}
          </div>
          <p className="lle-hero__name" key={`n-${i}`}>
            {r?.name ?? " "}
          </p>
          <p className="lle-hero__pick">
            {r ? (
              <>
                Top pick · <strong>{r.tracks[0]?.track.title}</strong> — {r.tracks[0]?.track.artist}
              </>
            ) : (
              "Reading the light…"
            )}
          </p>
          <div className="lle-hero__dots" role="group" aria-label="Choose a demo print">
            {demoPhotos.map((d, n) => (
              <button key={d.id} aria-pressed={n === i} aria-label={`Show demo print ${n + 1}: ${d.title}`} onClick={() => setI(n)}>
                {n + 1}A
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="lle-hero__foot">
        <EdgePrint />
        <button className="lle-hero__scroll" onClick={() => scrollToId("lle-manifesto")}>
          Scroll to develop
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
const manifesto =
  "Every photo already hums with something. The hour the light came from. How warm it ran. How hard the shadows fell. Lightleak reads those things, makes a guess out loud — and hands the final say back to you.";

function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, "through");
  const reduced = useReducedMotion();
  const words = manifesto.split(" ");
  const lit = reduced ? words.length : Math.round(Math.max(0, Math.min(1, (p - 0.2) / 0.45)) * words.length);
  return (
    <section className="lle-manifesto" id="lle-manifesto" ref={ref}>
      <p className="lle-label">
        <span>Under the safelight</span>
      </p>
      <p className="lle-manifesto__text" aria-label={manifesto}>
        {words.map((w, n) => (
          <span key={n} className={n < lit ? "is-lit" : ""} aria-hidden="true">
            {w}{" "}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The signature: one demo print developing, pinned while you scroll.  */
/* ------------------------------------------------------------------ */
const stages = [
  {
    k: "Develop",
    t: "Into the tray",
    body: "Your photo is drawn onto a tiny 72-pixel canvas inside this browser tab. That's the only copy Lightleak ever looks at. Nothing is uploaded, nothing is kept unless you save it.",
  },
  {
    k: "Read",
    t: "Read the light",
    body: "It measures the colours that cover the most ground, how bright and how warm the frame runs, and how hard the contrast is. Plain measurements — written out so you can see them.",
  },
  {
    k: "Guess",
    t: "Guess a mood",
    body: "Those measurements become a first guess at a feeling. It's a guess, not a verdict. You knew what that afternoon felt like; one tap changes it.",
  },
  {
    k: "Print",
    t: "Print the sheet",
    body: "Eight songs from a small, hand-tagged demo catalogue, laid out like a contact sheet. Circle the ones that fit, pick one for the post.",
  },
];

function Development({ reading }: { reading?: Reading }) {
  const track = useRef<HTMLElement>(null);
  const p = useScrollProgress(track, "track");
  const reduced = useReducedMotion();
  const n = stages.length;
  const index = Math.min(n - 1, Math.floor(p * n * 0.999));
  const local = Math.max(0, Math.min(1, p * n - index));
  const develop = reduced ? 1 : index > 0 ? 1 : Math.min(1, local * 1.4);
  const a = reading?.analysis;
  const top: Mood[] = a ? topMoods(a.moods, 4) : [];
  const maxMood = a ? Math.max(...top.map((m) => a.moods[m]), 0.01) : 1;
  const palette = a?.palette.map((s) => s.hex) ?? [];

  const jump = (i: number) => {
    const el = track.current;
    if (!el) return;
    const topY = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: topY + span * ((i + 0.35) / n), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section className={`lle-dev ${reduced ? "is-static" : ""}`} id="lle-develop" ref={track} aria-labelledby="lle-dev-title">
      <div className="lle-dev__stage">
        <header className="lle-dev__head">
          <p className="lle-label">
            <span>How it reads · one demo print</span>
          </p>
          <h2 id="lle-dev-title" className="lle-h2">
            Four baths, <em>one photo.</em>
          </h2>
        </header>

        <div className="lle-dev__tray">
          <div className="lle-dev__bath" aria-hidden="true">
            <span className="lle-dev__ripple" />
          </div>
          <figure className="lle-dev__print" style={{ "--dev": develop } as React.CSSProperties}>
            {reading ? <img src={reading.src} alt={`Demo photo, painted in the browser: ${reading.demo.title}`} /> : <span className="lle-dev__blank" />}
            <figcaption>{reading?.demo.title ?? "Demo print"}</figcaption>
          </figure>
          <span className="lle-dev__timer" aria-hidden="true">
            {stages[index].k.toUpperCase()} · 0:{String(Math.round(15 + (index + local) * 15)).padStart(2, "0")}
          </span>
        </div>

        <ol className="lle-dev__steps">
          {stages.map((s, k) => (
            <li key={s.k} className={`lle-dev__step ${k === index ? "is-on" : ""} ${k < index ? "is-past" : ""}`}>
              <button className="lle-dev__tab" onClick={() => jump(k)} aria-current={k === index ? "step" : undefined}>
                <span>0{k + 1}</span>
                {s.k}
              </button>
              <div className="lle-dev__panel">
                <h3 className="lle-dev__t">{s.t}</h3>
                <p className="lle-dev__body">{s.body}</p>
                {k === 0 && (
                  <ul className="lle-dev__facts">
                    <li>
                      <b>72px</b> analysis canvas
                    </li>
                    <li>
                      <b>0</b> bytes uploaded
                    </li>
                  </ul>
                )}
                {k === 1 && a && (
                  <div className="lle-dev__read">
                    <div className="lle-dev__swatches">
                      {a.palette.map((s2) => (
                        <span key={s2.hex} style={{ flexGrow: Math.max(0.6, s2.share * 10) }}>
                          <i style={{ background: s2.hex }} />
                          <small>{s2.name}</small>
                          <small className="lle-mono">{s2.hex}</small>
                        </span>
                      ))}
                    </div>
                    <ul className="lle-dev__notes">
                      {a.notes.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {k === 2 && a && (
                  <ul className="lle-dev__moods">
                    {top.map((m, j) => (
                      <li key={m}>
                        <span className="lle-dev__mood">{m}</span>
                        <span className="lle-dev__meter">
                          <i style={{ width: `${(a.moods[m] / maxMood) * 100}%` }} />
                        </span>
                        {j === 0 && <span className="lle-pencil">first guess</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {k === 3 && reading && (
                  <div className="lle-dev__sheet">
                    <p className="lle-dev__plname">{reading.name}</p>
                    <ol>
                      {reading.tracks.slice(0, 8).map(({ track: t }, j) => (
                        <li key={t.id} style={{ "--i": j } as React.CSSProperties}>
                          <Cover track={t} palette={palette} size={88} />
                          <span>{t.title}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="lle-fine">Covers are generated stand-ins. Song titles are real; no audio or streaming service is involved.</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="lle-dev__progress" aria-hidden="true">
          <i style={{ transform: `scaleX(${p})` }} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function ContactSheet({ readings, onOpen }: { readings: Reading[]; onOpen: (r: Reading) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref);
  return (
    <section className="lle-sheet" id="lle-sheet" aria-labelledby="lle-sheet-title">
      <div className="lle-sheet__intro">
        <p className="lle-label">
          <span>The contact sheet</span>
          <span>Four demo frames</span>
        </p>
        <h2 id="lle-sheet-title" className="lle-h2">
          <SplitWords text="Pick a frame." />
          <br />
          <em>
            <SplitWords text="Hear what it reads as." delay={160} />
          </em>
        </h2>
        <Reveal as="p" className="lle-sheet__lede" delay={200}>
          No photo handy? These four were painted in the browser for the prototype. The readings under each one are live — the
          same code your own photo would go through.
        </Reveal>
      </div>
      <div className="lle-sheet__film" ref={ref}>
        <EdgePrint from={21} count={10} label="LIGHTLEAK 400 · DEMO" />
        <ol className="lle-sheet__frames">
          {demoPhotos.map((d, n) => {
            const r = readings.find((x) => x.demo.id === d.id);
            const top = r ? topMoods(r.analysis.moods, 2) : [];
            return (
              <Reveal as="li" key={d.id} kind="clip" delay={n * 110} className="lle-frame">
                <span className="lle-frame__num" aria-hidden="true">
                  {n + 21}A
                </span>
                <div className="lle-frame__img">
                  {r && <img src={r.src} alt="" />}
                  <svg className="lle-frame__ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M50 4 C 80 3, 97 22, 96 50 C 95 80, 76 97, 48 96 C 20 95, 3 78, 4 48 C 5 22, 24 6, 56 5" pathLength="1" />
                  </svg>
                </div>
                <div className="lle-frame__meta">
                  <p className="lle-frame__title">{d.title}</p>
                  <div className="lle-swatches lle-swatches--thin">
                    {r?.analysis.palette.map((s) => <i key={s.hex} style={{ background: s.hex, flexGrow: Math.max(0.5, s.share * 10) }} title={`${s.name} ${s.hex}`} />)}
                  </div>
                  <p className="lle-frame__moods">{top.join(" · ") || " "}</p>
                  <p className="lle-frame__name">{r?.name ?? " "}</p>
                  <p className="lle-frame__pick">{r ? `${r.tracks[0]?.track.title} — ${r.tracks[0]?.track.artist}` : "Reading…"}</p>
                  <button className="lle-frame__go" disabled={!r} onClick={() => r && onOpen(r)} aria-label={`Develop this frame: ${d.title}`}>
                    Develop this frame <span aria-hidden="true">→</span>
                  </button>
                </div>
              </Reveal>
            );
          })}
        </ol>
        <EdgePrint from={31} count={10} label="LIGHTLEAK 400 · DEMO" />
      </div>
      <p className="lle-sheet__note">
        <span className="lle-pencil">← circle the ones that fit</span>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
const rules = [
  {
    n: "01",
    t: "It stays in the darkroom.",
    b: "Photos are read on your device and never uploaded. Saved playlists live in this browser's storage and nowhere else.",
  },
  {
    n: "02",
    t: "A guess, out loud.",
    b: "The mood is an interpretation of colour and light, shown with its working. Every suggestion can be overruled in one tap.",
  },
  {
    n: "03",
    t: "No pretend connections.",
    b: "Recommendations come from a small hand-tagged demo catalogue, not an AI model or a streaming service. Mood sketches are synthesised loops, not the songs.",
  },
];

function HouseRules() {
  return (
    <section className="lle-rules" id="lle-rules" aria-labelledby="lle-rules-title">
      <div className="lle-rules__head">
        <p className="lle-label">
          <span>Printed on the back</span>
        </p>
        <h2 id="lle-rules-title" className="lle-h2">
          <SplitWords text="House rules." />
        </h2>
      </div>
      <ol className="lle-rules__list">
        {rules.map((r, k) => (
          <Reveal as="li" key={r.n} delay={k * 120}>
            <span className="lle-rules__n">{r.n}</span>
            <h3>{r.t}</h3>
            <p>{r.b}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Footer({ onStart, savedCount, onLibrary }: { onStart: () => void; savedCount: number; onLibrary: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, "through");
  const reduced = useReducedMotion();
  return (
    <footer className="lle-foot" ref={ref} style={{ "--leak": reduced ? 1 : Math.min(1, p * 1.6) } as React.CSSProperties}>
      <div className="lle-foot__cta">
        <Reveal as="p" kind="fade" className="lle-label">
          <span>Last frame on the roll</span>
        </Reveal>
        <h2 className="lle-foot__title">
          <SplitWords text="Turn the light on." />
        </h2>
        <Reveal className="lle-hero__ctas" delay={200}>
          <button className="lle-btn" onClick={onStart}>
            <span className="lle-btn__dot" aria-hidden="true" />
            Add a photo
          </button>
          {savedCount > 0 && (
            <button className="lle-btn lle-btn--ghost" onClick={onLibrary}>
              Saved playlists ({savedCount})
            </button>
          )}
        </Reveal>
      </div>
      <p className="lle-foot__mark" aria-hidden="true">
        Lightleak
      </p>
      <EdgePrint from={36} count={12} label="END OF ROLL" />
      <div className="lle-foot__small">
        <p>Lightleak is a self-initiated concept, not a released product.</p>
        <p>Song titles and artists are real; covers are generated stand-ins and no streaming service is connected. Photos never leave your browser.</p>
      </div>
    </footer>
  );
}

