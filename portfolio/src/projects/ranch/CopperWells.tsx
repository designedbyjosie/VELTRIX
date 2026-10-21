import { useEffect, useRef, useState } from "react";
import "@fontsource/alfa-slab-one/400.css";
import "@fontsource/libre-caslon-text/400.css";
import "@fontsource/libre-caslon-text/400-italic.css";
import "@fontsource/libre-caslon-text/700.css";
import "@fontsource/special-elite/400.css";
import { useReducedMotion } from "../../lib/motion";
import { useFocusTrap } from "../../lib/useFocusTrap";
import { useParallax } from "../../lib/scroll";
import { locations, type LocationId } from "./data";
import { Scene3D, FlatLandscape } from "./Entrance";
import { webglAvailable } from "./gl";
import type { TimeOfDay } from "./scene3d";
import { Ambient } from "./ambient";
import { Story, Activities, Stays, PropertyMap, PhotoBox, Postcards, Journal } from "./Sections";
import { Visit, Inquiry } from "./Visit";
import { LocationArt } from "./LocationArt";
import { Bar, go } from "./Bar";
import { SunsetChapters, FourLights, Footer } from "./Chapters";
import "./ranch.css";

const times: [TimeOfDay, string][] = [
  ["dawn", "Dawn"],
  ["day", "Midday"],
  ["dusk", "Dusk"],
  ["night", "Night"],
];

const TITLE = ["Copper", "Wells"];

export default function CopperWells({ path }: { path: string[] }) {
  const reduced = useReducedMotion();
  const [gl] = useState(webglAvailable);
  const [mode, setMode] = useState<"3d" | "flat">(() =>
    webglAvailable() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "3d" : "flat",
  );
  const [time, setTime] = useState<TimeOfDay>("dusk");
  const [arrived, setArrived] = useState(path[0] === "explore");
  const [riding, setRiding] = useState(false);
  const [ride, setRide] = useState(0);
  const [skip, setSkip] = useState(0);
  const [reset, setReset] = useState(0);
  const [open, setOpen] = useState<LocationId | null>(null);
  const [sound, setSound] = useState(false);
  const [visitPreset, setVisitPreset] = useState<string | null>(null);
  const ambient = useRef<Ambient | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const flat = mode === "flat";
  useParallax(hero);

  useEffect(() => {
    ambient.current?.setTime(time);
  }, [time]);
  useEffect(() => () => ambient.current?.stop(), []);

  const toggleSound = () => {
    if (sound) {
      ambient.current?.stop();
      ambient.current = null;
      setSound(false);
    } else {
      const a = new Ambient();
      if (a.start(time)) {
        ambient.current = a;
        setSound(true);
      }
    }
  };

  const rideIn = () => {
    if (flat || reduced) {
      setArrived(true);
      return;
    }
    setRiding(true);
    setRide((n) => n + 1);
  };

  const backToGate = () => {
    setArrived(false);
    setRiding(false);
    setReset((n) => n + 1);
  };

  const toTop = () => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });

  const planFrom = (kind?: string) => {
    setOpen(null);
    setVisitPreset(kind ?? null);
    go("cw-visit", !reduced);
  };

  return (
    <div className={`cw cw--${time}`} ref={root} id="cw-top">
      <a className="cw-skip" href="#cw-story" onClick={(e) => (e.preventDefault(), go("cw-story", false))}>
        Skip the landscape
      </a>
      <Bar root={root} reduced={reduced} onPlan={() => planFrom()} />

      <section ref={hero} className={`cw-hero ${arrived ? "is-arrived" : ""} ${riding ? "is-riding" : ""}`} aria-label="The ranch landscape">
        <div className="cw-hero__world">
          {flat ? (
            <FlatLandscape time={time} arrived={arrived} onOpen={setOpen} />
          ) : (
            <Scene3D
              time={time}
              arrived={arrived}
              riding={riding}
              rideRequest={ride}
              skipRequest={skip}
              resetRequest={reset}
              onArrive={() => {
                setRiding(false);
                setArrived(true);
              }}
              onOpen={setOpen}
              onFail={() => setMode("flat")}
            />
          )}
        </div>
        <div className="cw-hero__grain" aria-hidden="true" />
        <div className="cw-hero__frame" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>

        {!arrived && (
          <div className={`cw-poster ${riding ? "is-leaving" : ""}`}>
            <p className="cw-poster__kicker">
              <span>A guest ranch in the Vara Valley</span>
              <span className="cw-poster__star" aria-hidden="true">✦</span>
              <span>Est. 1891</span>
            </p>
            <h1 className="cw-poster__title">
              <span className="cw-sr">Copper Wells</span>
              {TITLE.map((word, w) => (
                <span className="cw-poster__word" key={word} aria-hidden="true">
                  {[...word].map((ch, i) => (
                    <span key={i} className="cw-poster__ch" style={{ "--i": w * 6 + i } as React.CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="cw-poster__line">Thirty miles of dirt road, fourteen horses, and a sky that goes all the way down.</p>
            {!riding && (
              <div className="cw-poster__ctas">
                <button className="cw-btn cw-btn--big" onClick={rideIn}>
                  Ride in <span className="cw-btn__arrow" aria-hidden="true">→</span>
                </button>
                <a className="cw-poster__alt" href="#cw-story" onClick={(e) => (e.preventDefault(), go("cw-story", !reduced))}>
                  Or read the story first
                </a>
              </div>
            )}
          </div>
        )}
        {riding && (
          <button className="cw-btn cw-btn--ghost cw-hero__skip" onClick={() => setSkip((n) => n + 1)}>
            Skip the ride
          </button>
        )}
        {arrived && (
          <div className="cw-arrived">
            <p className="cw-arrived__kicker">Copper Wells · {times.find(([t]) => t === time)?.[1]}</p>
            <p className="cw-arrived__title">You've arrived.</p>
            <p>Choose a place on the ranch to explore it.</p>
            <ul className="cw-arrived__list">
              {locations.map((l, i) => (
                <li key={l.id}>
                  <button onClick={() => setOpen(l.id)}>
                    <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    {l.name}
                  </button>
                </li>
              ))}
            </ul>
            <button className="cw-textbtn" onClick={backToGate}>
              ← Back to the gate
            </button>
          </div>
        )}

        <div className="cw-hero__controls">
          <div className="cw-seg" role="radiogroup" aria-label="Time of day">
            {times.map(([t, label]) => (
              <button key={t} role="radio" aria-checked={time === t} onClick={() => setTime(t)}>
                <span className={`cw-seg__dot cw-seg__dot--${t}`} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <button className="cw-chipbtn" aria-pressed={sound} onClick={toggleSound}>
            <span className={`cw-eq ${sound ? "is-on" : ""}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {sound ? "Sound on — turn off" : "Turn on sound"}
          </button>
          {gl && (
            <button className="cw-chipbtn" aria-pressed={flat} onClick={() => setMode(flat ? "3d" : "flat")}>
              {flat ? "Switch to 3D" : "Flat view"}
            </button>
          )}
        </div>
        {!arrived && !riding && (
          <span className="cw-hero__cue" aria-hidden="true">
            <span>Scroll</span>
          </span>
        )}
        {!gl && <p className="cw-hero__note">Showing the illustrated landscape — this browser doesn't support WebGL.</p>}
        {gl && flat && reduced && <p className="cw-hero__note">Showing the still landscape because your device asks for reduced motion.</p>}
      </section>

      <SunsetChapters reduced={reduced} />
      <Story />
      <Activities onPlan={planFrom} />
      <Stays onPlan={planFrom} />
      <FourLights
        reduced={reduced}
        onSee={(t) => {
          setTime(t);
          toTop();
        }}
      />
      <PropertyMap onOpen={setOpen} />
      <PhotoBox />
      <Postcards />
      <Journal />
      <Visit preset={visitPreset} />
      <Inquiry />

      <Footer
        reduced={reduced}
        onPlan={() => planFrom()}
        onGate={() => {
          backToGate();
          toTop();
        }}
      />

      {open && <LocationPanel id={open} onClose={() => setOpen(null)} onPlan={planFrom} onGo={setOpen} />}
    </div>
  );
}

function LocationPanel({ id, onClose, onPlan, onGo }: { id: LocationId; onClose: () => void; onPlan: (k?: string) => void; onGo: (id: LocationId) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onClose);
  const l = locations.find((x) => x.id === id)!;
  const i = locations.indexOf(l);
  const next = locations[(i + 1) % locations.length];
  const prev = locations[(i - 1 + locations.length) % locations.length];
  const cta: Record<string, string> = { stay: "See the rooms and plan a stay", ride: "Add a ride to your visit", evening: "Plan an evening here", visit: "Plan your visit" };
  return (
    <div className="cw-panel-scrim" onClick={onClose}>
      <div className="cw-panel" role="dialog" aria-modal="true" aria-labelledby="cw-panel-title" ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="cw-panel__art" style={{ background: l.colour }} key={id}>
          <LocationArt id={l.id} />
          <span className="cw-panel__stamp">{l.name.replace("The ", "")}</span>
        </div>
        <div className="cw-panel__body">
          <button className="cw-panel__close" onClick={onClose} data-autofocus>
            Close
          </button>
          <p className="cw-panel__kicker">{l.hours}</p>
          <h2 id="cw-panel-title">{l.name}</h2>
          <p className="cw-panel__short">{l.short}</p>
          {l.body.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
          <dl className="cw-facts">
            {l.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {l.related && (
            <button className="cw-btn" onClick={() => onPlan(l.related)}>
              {cta[l.related]}
            </button>
          )}
          <nav className="cw-panel__nav" aria-label="Other places">
            <button className="cw-textbtn" onClick={() => onGo(prev.id)}>
              Previous: {prev.name}
            </button>
            <button className="cw-textbtn" onClick={() => onGo(next.id)}>
              Next: {next.name}
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
