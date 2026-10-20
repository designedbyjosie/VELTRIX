import { useEffect, useRef, useState } from "react";
import "@fontsource/alfa-slab-one/400.css";
import "@fontsource/libre-caslon-text/400.css";
import "@fontsource/libre-caslon-text/400-italic.css";
import "@fontsource/libre-caslon-text/700.css";
import "@fontsource/special-elite/400.css";
import { useReducedMotion } from "../../lib/motion";
import { useFocusTrap } from "../../lib/useFocusTrap";
import { locations, type LocationId } from "./data";
import { Scene3D, FlatLandscape } from "./Entrance";
import { webglAvailable, type TimeOfDay } from "./scene3d";
import { Ambient } from "./ambient";
import { Story, Activities, Stays, PropertyMap, PhotoBox, Postcards, Journal } from "./Sections";
import { Visit, Inquiry } from "./Visit";
import { LocationArt } from "./LocationArt";
import "./ranch.css";

const times: [TimeOfDay, string][] = [
  ["dawn", "Dawn"],
  ["day", "Midday"],
  ["dusk", "Dusk"],
  ["night", "Night"],
];

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
  const flat = mode === "flat";

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

  const planFrom = (kind?: string) => {
    setOpen(null);
    setVisitPreset(kind ?? null);
    document.getElementById("cw-visit")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className={`cw cw--${time}`}>
      <a className="cw-skip" href="#cw-story" onClick={(e) => (e.preventDefault(), document.getElementById("cw-story")?.scrollIntoView())}>
        Skip the landscape
      </a>
      <header className="cw-bar">
        <span className="cw-bar__mark">Copper Wells</span>
        <nav aria-label="Copper Wells Ranch">
          <a href="#cw-story" onClick={(e) => (e.preventDefault(), document.getElementById("cw-story")?.scrollIntoView({ behavior: "smooth" }))}>Story</a>
          <a href="#cw-do" onClick={(e) => (e.preventDefault(), document.getElementById("cw-do")?.scrollIntoView({ behavior: "smooth" }))}>Things to do</a>
          <a href="#cw-map" onClick={(e) => (e.preventDefault(), document.getElementById("cw-map")?.scrollIntoView({ behavior: "smooth" }))}>Map</a>
          <a href="#cw-archive" onClick={(e) => (e.preventDefault(), document.getElementById("cw-archive")?.scrollIntoView({ behavior: "smooth" }))}>Archive</a>
          <a className="cw-bar__cta" href="#cw-visit" onClick={(e) => (e.preventDefault(), planFrom())}>Plan a visit</a>
        </nav>
      </header>

      <section className={`cw-hero ${arrived ? "is-arrived" : ""} ${riding ? "is-riding" : ""}`} aria-label="The ranch landscape">
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
        <div className="cw-hero__grain" aria-hidden="true" />

        {!arrived && (
          <div className={`cw-poster ${riding ? "is-leaving" : ""}`}>
            <p className="cw-poster__kicker">A guest ranch in the Vara Valley · Est. 1891</p>
            <h1 className="cw-poster__title">
              Copper
              <br />
              Wells
            </h1>
            <p className="cw-poster__line">Thirty miles of dirt road, fourteen horses, and a sky that goes all the way down.</p>
            {!riding && (
              <button className="cw-btn cw-btn--big" onClick={rideIn}>
                Ride in
              </button>
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
            <p className="cw-arrived__title">You've arrived.</p>
            <p>Choose a place on the ranch to explore it.</p>
            <ul className="cw-arrived__list">
              {locations.map((l) => (
                <li key={l.id}>
                  <button onClick={() => setOpen(l.id)}>{l.name}</button>
                </li>
              ))}
            </ul>
            <button className="cw-textbtn" onClick={backToGate}>
              Back to the gate
            </button>
          </div>
        )}

        <div className="cw-hero__controls">
          <div className="cw-seg" role="radiogroup" aria-label="Time of day">
            {times.map(([t, label]) => (
              <button key={t} role="radio" aria-checked={time === t} onClick={() => setTime(t)}>
                {label}
              </button>
            ))}
          </div>
          <button className="cw-chipbtn" aria-pressed={sound} onClick={toggleSound}>
            {sound ? "Sound on — turn off" : "Turn on sound"}
          </button>
          {gl && (
            <button className="cw-chipbtn" aria-pressed={flat} onClick={() => setMode(flat ? "3d" : "flat")}>
              {flat ? "Switch to 3D" : "Flat view"}
            </button>
          )}
        </div>
        {!gl && <p className="cw-hero__note">Showing the illustrated landscape — this browser doesn't support WebGL.</p>}
        {gl && flat && reduced && <p className="cw-hero__note">Showing the still landscape because your device asks for reduced motion.</p>}
      </section>

      <Story />
      <Activities onPlan={planFrom} />
      <Stays onPlan={planFrom} />
      <PropertyMap onOpen={setOpen} />
      <PhotoBox />
      <Postcards />
      <Journal />
      <Visit preset={visitPreset} />
      <Inquiry />

      <footer className="cw-foot">
        <p className="cw-foot__mark">Copper Wells Ranch</p>
        <p>
          A fictional destination designed as a self-initiated portfolio concept. The ranch, the valley, its history and
          its people are invented. No bookings or enquiries are processed.
        </p>
      </footer>

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
