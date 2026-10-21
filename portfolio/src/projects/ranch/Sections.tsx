import { useRef, useState } from "react";
import { asset } from "../../lib/asset";
import { Reveal, useParallax, useScrollProgress } from "../../lib/scroll";
import { SectionHead } from "./Chapters";
import { activities, journal, locations, stays, timeline, type LocationId } from "./data";
import { LocationArt } from "./LocationArt";

function Timeline() {
  const ref = useRef<HTMLOListElement>(null);
  const p = useScrollProgress(ref, "through");
  // the dashed trail fills in copper as the timeline passes the middle of the screen
  const fill = Math.max(0, Math.min(1, (p - 0.18) / 0.55));
  return (
    <ol className="cw-timeline" ref={ref} style={{ "--fill": fill.toFixed(3) } as React.CSSProperties}>
      {timeline.map((t, i) => (
        <Reveal as="li" kind="slide-right" key={t.year} delay={i * 40}>
          <span className="cw-timeline__year">{t.year}</span>
          <div>
            <h3>{t.title}</h3>
            <p>{t.body}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

export function Story() {
  return (
    <section className="cw-section cw-story" id="cw-story" aria-labelledby="cw-story-title">
      <div className="cw-story__intro">
        <SectionHead
          num="01"
          kicker="The story so far"
          title="A ranch that never stopped working"
          id="cw-story-title"
          lede="Copper Wells has been a homestead, a cattle ranch, a stop for train travellers and — for the last ninety years — a place people come to sleep under more stars than they knew existed."
        />
        <Reveal kind="clip" className="cw-plate" delay={120}>
          <img src={asset("img/ranch/ranch-yard-dusk.jpg")} width={1600} height={1000} loading="lazy" decoding="async" alt="The ranch yard at dusk from above: windmill, stock tank, adobe house, barn and a lit campfire circle, rendered from the 3D scene" />
          <span className="cw-plate__cap">Plate I · The yard at copper hour</span>
        </Reveal>
        <Reveal as="p" className="cw-typed" delay={200}>
          Long before the homestead, this land was home to Indigenous peoples whose histories are theirs to tell. Our archive begins in
          1891 and tells only the ranch's own story.
        </Reveal>
      </div>
      <Timeline />
    </section>
  );
}

export function Activities({ onPlan }: { onPlan: (k?: string) => void }) {
  return (
    <section className="cw-section cw-do" id="cw-do" aria-labelledby="cw-do-title">
      <div className="cw-do__inner">
        <SectionHead num="02" kicker="Days on the ranch" title="Things to do, slowly" id="cw-do-title" light lede="Six ways to spend a day, none of them in a hurry. Prices are sample figures for this concept." />
        <ul className="cw-tickets">
          {activities.map((a, i) => (
            <Reveal as="li" key={a.id} className="cw-ticket" delay={(i % 3) * 90}>
              <div className="cw-ticket__main">
                <span className="cw-ticket__time">{a.time}</span>
                <h3>{a.name}</h3>
                <p>{a.detail}</p>
                <span className="cw-ticket__price">{a.price ? `$${a.price} per guest` : "Included with your stay"}</span>
              </div>
              <div className="cw-ticket__stub" aria-hidden="true">
                <span>Admit one</span>
                <span className="cw-ticket__no">No. {String(i + 1).padStart(3, "0")}</span>
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal kind="fade">
          <button className="cw-btn cw-btn--light" onClick={() => onPlan("ride")}>
            Add activities to a visit <span className="cw-btn__arrow" aria-hidden="true">→</span>
          </button>
        </Reveal>
      </div>
    </section>
  );
}

function StayCard({ s, i }: { s: (typeof stays)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref);
  return (
    <Reveal as="article" className="cw-stay" delay={i * 110}>
      <div className="cw-stay__art" aria-hidden="true" ref={ref}>
        <div className="cw-stay__parallax">
          <LocationArt id={i === 0 ? "house" : i === 1 ? "trail" : "stables"} />
        </div>
        <span className="cw-stay__tag">Sleeps {s.sleeps}</span>
      </div>
      <h3>{s.name}</h3>
      <p>{s.detail}</p>
      <p className="cw-stay__meta">
        <span>From ${s.nightly}</span> a night, meals included
      </p>
    </Reveal>
  );
}

export function Stays({ onPlan }: { onPlan: (k?: string) => void }) {
  return (
    <section className="cw-section cw-stays" aria-labelledby="cw-stays-title">
      <SectionHead num="03" kicker="Rooms & cabins" title="Where you'll sleep" id="cw-stays-title" lede="Three ways to stay, all within earshot of the dinner bell." />
      <div className="cw-stays__grid">
        {stays.map((s, i) => (
          <StayCard key={s.id} s={s} i={i} />
        ))}
      </div>
      <button className="cw-btn" onClick={() => onPlan("stay")}>
        Check sample availability <span className="cw-btn__arrow" aria-hidden="true">→</span>
      </button>
    </section>
  );
}

/** Illustrated property guide with a vintage route planner. */
export function PropertyMap({ onOpen }: { onOpen: (id: LocationId) => void }) {
  const [route, setRoute] = useState<LocationId[]>(["house", "stables", "trail"]);
  const toggle = (id: LocationId) => setRoute((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const pts = route.map((id) => locations.find((l) => l.id === id)!.map);
  let minutes = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    minutes += Math.round(Math.hypot(ax - bx, ay - by) * 1.6);
  }
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x * 10} ${y * 6}`).join(" ");
  return (
    <section className="cw-section cw-mapsec" id="cw-map">
      <SectionHead num="05" kicker="Property guide" title="The lay of the land" lede="Tap places to plot a day's route. Open any of them for the full story." />
      <div className="cw-mapsec__grid">
        <Reveal kind="scale" className="cw-map">
          <svg viewBox="0 0 1000 600" role="img" aria-label="Illustrated map of the ranch with your route">
            <rect width="1000" height="600" fill="#efe2c8" />
            <path d="M0 360 C200 330 300 420 500 380 S800 300 1000 340" stroke="#5e9c97" strokeWidth="18" fill="none" opacity=".45" />
            <text x="600" y="330" fontFamily="'Special Elite', monospace" fontSize="18" fill="#3b6f6b">Copper Wash</text>
            {Array.from({ length: 40 }, (_, i) => (
              <circle key={i} cx={(i * 211) % 1000} cy={(i * 97) % 600} r="6" fill="#56603a" opacity=".35" />
            ))}
            <path d="M120 40 L280 40 L300 180 L100 180Z" fill="#c98e3b" opacity=".5" />
            <text x="200" y="120" textAnchor="middle" fontFamily="'Alfa Slab One', serif" fontSize="16" fill="#3b2418">MESA</text>
            <path d="M500 560 C520 480 460 420 440 300" stroke="#c9a46a" strokeWidth="10" fill="none" strokeDasharray="2 10" strokeLinecap="round" />
            {d && <path d={d} stroke="#a2472a" strokeWidth="5" fill="none" strokeDasharray="14 10" className="cw-map__route" key={d} />}
            <g transform="translate(900 520)" fontFamily="'Special Elite', monospace" fontSize="14" fill="#3b2418">
              <path d="M0 -40 L8 -10 L0 -16 L-8 -10Z" fill="#3b2418" />
              <text y="12" textAnchor="middle">N</text>
            </g>
          </svg>
          {locations.map((l) => {
            const stop = route.indexOf(l.id);
            return (
              <button
                key={l.id}
                className={`cw-map__pin ${stop >= 0 ? "is-on" : ""}`}
                style={{ left: `${l.map[0]}%`, top: `${l.map[1]}%` }}
                aria-pressed={stop >= 0}
                aria-label={`${l.name}${stop >= 0 ? `, stop ${stop + 1} on your route` : ""}. Add or remove from route`}
                onClick={() => toggle(l.id)}
              >
                <span aria-hidden="true">{stop >= 0 ? stop + 1 : ""}</span>
              </button>
            );
          })}
        </Reveal>
        <Reveal kind="slide-right" className="cw-route" delay={150}>
          <h3>Your route</h3>
          {route.length === 0 ? (
            <p>No stops yet. Tap places on the map.</p>
          ) : (
            <ol>
              {route.map((id) => {
                const l = locations.find((x) => x.id === id)!;
                return (
                  <li key={id}>
                    <button className="cw-textbtn" onClick={() => onOpen(id)}>
                      {l.name}
                    </button>
                    <span>{l.hours}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="cw-route__total">
            {route.length > 1 ? `About ${minutes} minutes on horseback between stops` : "Add two stops to see travel time"}
          </p>
          {route.length > 0 && (
            <button className="cw-textbtn" onClick={() => setRoute([])}>
              Clear route
            </button>
          )}
        </Reveal>
      </div>
    </section>
  );
}

const photos = [
  { id: "p1", caption: "The gate, sign day, 1958", scene: "gate" as LocationId, tone: "sepia(.7)" },
  { id: "p2", caption: "Biscuit and June, 1987", scene: "stables" as LocationId, tone: "sepia(.4) saturate(.8)" },
  { id: "p3", caption: "First guests on the porch, 1936", scene: "house" as LocationId, tone: "grayscale(1) contrast(1.1)" },
  { id: "p4", caption: "Windmill rebuild, 1979", scene: "windmill" as LocationId, tone: "sepia(.5) hue-rotate(-10deg)" },
  { id: "p5", caption: "The mesa at last light", scene: "overlook" as LocationId, tone: "saturate(1.2)" },
  { id: "p6", caption: "A night at the circle", scene: "campfire" as LocationId, tone: "none" },
];

/** A box of photographs: tip it out, pick one up. */
export function PhotoBox() {
  const [spread, setSpread] = useState(false);
  const [top, setTop] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  const viewing = photos.find((p) => p.id === view);
  return (
    <section className="cw-section cw-photos" id="cw-archive">
      <SectionHead num="06" kicker="The family archive" title="A box of photographs" lede="Illustrated stand-ins for an imagined family archive. Tip the box out, then pick one up." />
      <div className={`cw-box ${spread ? "is-spread" : ""}`}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            className={`cw-photo ${top === p.id ? "is-top" : ""}`}
            style={
              {
                "--i": i,
                "--r": `${((i * 37) % 17) - 8}deg`,
                "--dx": `${(i - 2.5) * 150}px`,
                "--dy": `${((i % 2) - 0.5) * 120}px`,
                "--mx": `${((i % 2) - 0.5) * 160}px`,
                "--my": `${(Math.floor(i / 2) - 1) * 170}px`,
              } as React.CSSProperties
            }
            onClick={() => (spread ? setView(p.id) : setSpread(true))}
            onFocus={() => setTop(p.id)}
            onMouseEnter={() => setTop(p.id)}
            aria-label={spread ? `Look closer: ${p.caption}` : "Tip out the box of photographs"}
          >
            <span style={{ filter: p.tone }}>
              <LocationArt id={p.scene} />
            </span>
            <em>{p.caption}</em>
          </button>
        ))}
        {!spread && <span className="cw-box__lid" aria-hidden="true">Photographs · do not bend</span>}
      </div>
      {spread && (
        <button className="cw-textbtn" onClick={() => setSpread(false)}>
          Put them back in the box
        </button>
      )}
      {viewing && (
        <div className="cw-lightbox" role="dialog" aria-modal="true" aria-label={viewing.caption} onClick={() => setView(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <span style={{ filter: viewing.tone }}>
              <LocationArt id={viewing.scene} />
            </span>
            <figcaption>{viewing.caption}</figcaption>
            <button className="cw-btn" onClick={() => setView(null)} autoFocus onKeyDown={(e) => e.key === "Escape" && setView(null)}>
              Put it down
            </button>
          </figure>
        </div>
      )}
    </section>
  );
}

const cards = [
  { id: "c1", front: "overlook" as LocationId, title: "Greetings from the Mesa", back: "Dear Ma — rode up to the mesa tonight. The whole valley turned copper. Bringing you back a rock. — R." },
  { id: "c2", front: "campfire" as LocationId, title: "Nights at Copper Wells", back: "Counted 41 shooting stars, then lost count. The cook makes peach cobbler on Fridays. Don't tell the doctor." },
  { id: "c3", front: "windmill" as LocationId, title: "The Famous Copper Wells", back: "The water really is blue-green in the trough. They swear the tap water is fine. It is. Mostly." },
];

export function Postcards() {
  const [flipped, setFlipped] = useState<string[]>([]);
  return (
    <section className="cw-section cw-cards">
      <SectionHead num="07" kicker="General store" title="From the postcard rack" lede="Turn them over. All messages are fictional." />
      <div className="cw-cards__row">
        {cards.map((c, i) => {
          const on = flipped.includes(c.id);
          return (
            <Reveal key={c.id} className="cw-card__slot" delay={i * 120} style={{ "--tilt": `${(i - 1) * 1.6}deg` } as React.CSSProperties}>
            <button
              className={`cw-card ${on ? "is-flipped" : ""}`}
              aria-pressed={on}
              aria-label={on ? `${c.title}. Message: ${c.back}` : `${c.title}. Turn over to read`}
              onClick={() => setFlipped((f) => (on ? f.filter((x) => x !== c.id) : [...f, c.id]))}
            >
              <span className="cw-card__inner">
                <span className="cw-card__face cw-card__front">
                  <LocationArt id={c.front} />
                  <span className="cw-card__title">{c.title}</span>
                </span>
                <span className="cw-card__face cw-card__back">
                  <span className="cw-card__msg">{c.back}</span>
                  <span className="cw-card__addr">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="cw-card__stamp" />
                </span>
              </span>
            </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

const seasonTone = ["#7fa36b", "#c98e3b", "#a2472a", "#6f7fb0"];

export function Journal() {
  return (
    <section className="cw-section cw-journal" aria-labelledby="cw-journal-title">
      <SectionHead num="08" kicker="Four seasons" title="The ranch journal" id="cw-journal-title" />
      <div className="cw-journal__grid">
        {journal.map((j, i) => (
          <Reveal as="article" key={j.title} className="cw-entry" delay={i * 90} style={{ "--tone": seasonTone[i] } as React.CSSProperties}>
            <p className="cw-entry__date">
              <span className="cw-entry__glyph" aria-hidden="true" />
              {j.date}
            </p>
            <h3>{j.title}</h3>
            <p>{j.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
