import { useEffect, useMemo, useRef, useState } from "react";
import { href, navigate } from "../../lib/router";
import { prefersReducedMotion, useReducedMotion } from "../../lib/motion";
import { Reveal, SplitWords, useParallax, useScrollProgress } from "../../lib/scroll";
import { destinations, interestLabels, originLabels, type Destination } from "./data";
import { defaultInput, diffPlans, generate, money, rankDestinations, type Plan, type TripInput } from "./engine";
import { base } from "./Margin";

/**
 * The landing page: a travel journal you read from the top.
 * Every number on it is produced by the real planning engine running on the
 * sample data — nothing is mocked up by hand.
 */

// The worked example used throughout the story (same as the engine tests).
const example: TripInput = { ...defaultInput, destination: "lisbon", origin: "uk", days: 4, travelers: 2, budget: 2400, interests: ["food", "culture", "history"] };
const lineColours: Record<string, string> = {
  travel: "#3d6fb6",
  stay: "#6b4fa0",
  food: "#c2577a",
  local: "#5ba8a0",
  activities: "#e8a33d",
  misc: "#8c6d46",
  buffer: "#9aa3b5",
};

function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [query]);
  return on;
}

export function Home({ trips, setInput }: { trips: number; setInput: (f: (p: TripInput) => TripInput) => void }) {
  const plan = useMemo(() => generate(example), []);
  return (
    <div className="mgh">
      <Hero plan={plan} trips={trips} />
      <Manifesto />
      <Chapters plan={plan} />
      <Postcards setInput={setInput} />
      <Wont />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */
function Hero({ plan, trips }: { plan: Plan; trips: number }) {
  const ref = useRef<HTMLElement>(null);
  useParallax(ref);
  const dest = destinations.find((d) => d.id === plan.destinationId)!;
  const zones = dest.zones.slice(0, 4);
  return (
    <section className="mgh-hero" ref={ref} aria-labelledby="mgh-title">
      <div className="mgh-hero__copy">
        <Reveal as="p" kind="fade" className="mgh-kicker">
          <span>No. 01</span> A travel planner, written around you
        </Reveal>
        <h1 id="mgh-title" className="mgh-hero__title">
          <SplitWords text="Trips that fit" stagger={70} />
          <br />
          <SplitWords text="in the margins" className="mgh-ital" delay={180} stagger={70} />
          <br />
          <SplitWords text="of your life." delay={380} stagger={70} />
        </h1>
        <Reveal as="p" className="mgh-hero__lede" delay={560}>
          Tell Margin what you can spend, the days you really have and how you like to travel. It writes a realistic day-by-day
          plan inside those lines — and rewrites it, showing every change, when life moves them.
        </Reveal>
        <Reveal className="mgh-hero__ctas" delay={700}>
          <a className="mg-btn mg-btn--arrow" href={href(`${base}/plan`)}>
            Start a trip page <span aria-hidden="true">→</span>
          </a>
          {trips > 0 ? (
            <a className="mg-btn mg-btn--quiet" href={href(`${base}/trips`)}>
              Open your trips ({trips})
            </a>
          ) : (
            <a
              className="mg-btn mg-btn--quiet"
              href="#mgh-story"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("mgh-story")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
              }}
            >
              See how it plans
            </a>
          )}
        </Reveal>
      </div>

      <div className="mgh-collage" aria-hidden="true">
        <div className="mgh-layer mgh-layer--map">
          <svg viewBox="0 0 320 380" className="mgh-map">
            <rect x="0" y="0" width="320" height="380" fill="#fbf7ee" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} d={`M-10 ${70 + i * 34} C 60 ${40 + i * 36}, 140 ${110 + i * 30}, 210 ${70 + i * 34} S 300 ${60 + i * 32}, 340 ${90 + i * 30}`} fill="none" stroke="#e3dccb" strokeWidth="1" />
            ))}
            <path d="M0 300 C 50 280, 90 320, 150 298 S 260 262, 320 286 V380 H0Z" fill="#d6e4e6" />
            <path d="M0 300 C 50 280, 90 320, 150 298 S 260 262, 320 286" fill="none" stroke="#9fbcc2" strokeWidth="1.2" />
            <path
              className="mgh-route"
              d={`M${zones[0].x * 3} ${zones[0].y * 3.2} Q ${(zones[0].x + zones[1].x) * 1.5 + 30} ${(zones[0].y + zones[1].y) * 1.6 - 40} ${zones[1].x * 3} ${zones[1].y * 3.2} T ${zones[3].x * 3} ${zones[3].y * 3.2} T ${zones[2].x * 3 + 10} ${zones[2].y * 3.2 - 10}`}
              fill="none"
              stroke="#c4483f"
              strokeWidth="2"
              strokeDasharray="5 5"
              strokeLinecap="round"
            />
            {zones.map((z, i) => (
              <g key={z.id} transform={`translate(${i === 2 ? z.x * 3 + 10 : z.x * 3} ${i === 2 ? z.y * 3.2 - 10 : z.y * 3.2})`}>
                <circle r="9" fill="#1c2540" />
                <text y="3.5" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700" fontFamily="Public Sans, sans-serif">
                  {i + 1}
                </text>
                <text x="14" y="4" fontSize="17" fill="#3b4566" fontFamily="Caveat, cursive">
                  {z.name.split(" ")[0]}
                </text>
              </g>
            ))}
            <text x="18" y="34" fontSize="13" letterSpacing="3" fill="#8a8370" fontFamily="Public Sans, sans-serif" fontWeight="700">
              LISBON · SHEET 2
            </text>
            <g transform="translate(276 40)" stroke="#8a8370" fill="none">
              <circle r="16" />
              <path d="M0 -22 V22 M-22 0 H22" strokeWidth="0.8" />
              <path d="M0 -16 L4 0 L0 16 L-4 0Z" fill="#8a8370" />
            </g>
          </svg>
        </div>

        <div className="mgh-layer mgh-layer--ticket">
          <div className="mgh-ticket">
            <div className="mgh-ticket__main">
              <p className="mgh-ticket__label">Trip page · estimate</p>
              <p className="mgh-ticket__route">
                <span>{originLabels[example.origin].split(" ")[0]}</span>
                <i>→</i>
                <span>{dest.name}</span>
              </p>
              <dl>
                <div>
                  <dt>Days</dt>
                  <dd>{plan.effectiveDays}</dd>
                </div>
                <div>
                  <dt>People</dt>
                  <dd>{example.travelers}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{money(plan.total)}</dd>
                </div>
              </dl>
            </div>
            <div className="mgh-ticket__stub">
              <span>of {money(plan.budget)}</span>
            </div>
          </div>
        </div>

        <div className="mgh-layer mgh-layer--stamp">
          <div className="mgh-stamp">
            <span className="mgh-stamp__inner">
              <b>{plan.effectiveDays}</b>
              <small>days that fit</small>
            </span>
          </div>
        </div>

        <div className="mgh-layer mgh-layer--note">
          <p className="mgh-hand">
            keep day 3's afternoon empty
            <svg viewBox="0 0 60 40" width="52" height="34">
              <path d="M4 6 C 20 4, 40 12, 48 32 M38 28 L48 33 L52 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </p>
        </div>
      </div>
      <p className="mgh-hero__fine">Self-initiated concept · sample data · nothing is ever booked or sent</p>
    </section>
  );
}

/* ------------------------------------------------------------------ manifesto */
const manifesto =
  "Most planners start with a destination and work backwards to your wallet. Margin starts in the margins — the money, the days off and the energy you actually have — and writes the trip inside them.";

function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, "through");
  const reduced = useReducedMotion();
  const words = manifesto.split(" ");
  const lit = reduced ? words.length : Math.round(Math.max(0, Math.min(1, (p - 0.2) / 0.4)) * words.length);
  return (
    <section className="mgh-manifesto" ref={ref} aria-label="The idea">
      <Reveal as="p" kind="slide-left" className="mgh-margin-note mgh-hand">
        the whole idea, really
      </Reveal>
      <p className="mgh-manifesto__text">
        <span className="sr-only">{manifesto}</span>
        <span aria-hidden="true">
          {words.map((w, i) => (
            <span key={i} className={i < lit ? "is-lit" : ""}>
              {w}{" "}
            </span>
          ))}
        </span>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ pinned chapters */
const chapters = [
  {
    n: "i.",
    title: "Your life first",
    body: "Budget, days off, pace, walking, food and access needs. Only what's useful, and most of it optional — the answers fill in the trip page as you go.",
  },
  {
    n: "ii.",
    title: "The real budget",
    body: "Getting there, sleeping, eating and getting around come out first. What's left is what the days can spend — before a single ticket is chosen.",
  },
  {
    n: "iii.",
    title: "A plan that adapts, out loud",
    body: "Lower the budget and the stay changes, paid plans give way to free ones — and Margin writes each swap in the margin so nothing moves silently.",
  },
];

function Chapters({ plan }: { plan: Plan }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const narrow = useMedia("(max-width: 860px)");
  const pinned = !reduced && !narrow;
  const p = useScrollProgress(ref, "track");
  const scaled = Math.min(2.999, p * 3);
  const active = pinned ? Math.floor(scaled) : -1;
  const sub = pinned ? scaled - Math.floor(scaled) : 1;

  return (
    <section id="mgh-story" ref={ref} className={`mgh-chapters ${pinned ? "is-pinned" : "is-stacked"}`} aria-labelledby="mgh-ch-title">
      <div className="mgh-chapters__stage">
        <div className="mgh-chapters__copy">
          <p className="mgh-eyebrow">How a trip gets written</p>
          <h2 id="mgh-ch-title" className="sr-only">
            How a trip gets written
          </h2>
          {pinned && (
            <span className="mgh-chapters__rail" aria-hidden="true">
              <b style={{ transform: `scaleY(${p})` }} />
            </span>
          )}
          <ol className="mgh-chapters__list">
            {chapters.map((c, i) => (
              <li key={c.n} className={pinned ? (i === active ? "is-now" : i < active ? "is-past" : "") : ""}>
                <span className="mgh-chapters__n">{c.n}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                {!pinned && (
                  <div className="mgh-figure mgh-figure--inline">
                    <Figure i={i} plan={plan} sub={1} interactive />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
        {pinned && (
          <div className="mgh-chapters__page" aria-hidden="true">
            {chapters.map((c, i) => (
              <div key={c.n} className={`mgh-figure ${i === active ? "is-now" : i < active ? "is-past" : ""}`}>
                <Figure i={i} plan={plan} sub={i === active ? sub : i < active ? 1 : 0} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Figure({ i, plan, sub, interactive = false }: { i: number; plan: Plan; sub: number; interactive?: boolean }) {
  if (i === 0) return <FigAnswers sub={sub} />;
  if (i === 1) return <FigBudget plan={plan} sub={sub} />;
  return <FigAdapt sub={sub} interactive={interactive} />;
}

function FigAnswers({ sub }: { sub: number }) {
  const rows: [string, string][] = [
    ["Starting from", originLabels[example.origin]],
    ["How long", `${example.days} days`],
    ["Who", `${example.travelers} travellers`],
    ["Budget", `${money(example.budget)}, travel included`],
    ["Pace", "balanced, early starts fine"],
    ["Loves", example.interests.map((k) => interestLabels[k].toLowerCase()).join(", ")],
  ];
  const shown = Math.ceil(Math.min(1, sub * 1.4) * rows.length);
  return (
    <div className="mgh-sheet">
      <p className="mgh-sheet__head">Questions · page 1 of 4</p>
      <dl className="mgh-answers">
        {rows.map(([k, v], idx) => (
          <div key={k} className={idx < shown ? "is-in" : ""}>
            <dt>{k}</dt>
            <dd className="mgh-hand">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mgh-sheet__foot">Food and access answers only filter suggestions, and stay in your browser.</p>
    </div>
  );
}

function FigBudget({ plan, sub }: { plan: Plan; sub: number }) {
  const lines = plan.lines.filter((l) => l.amount > 0);
  const scale = Math.max(plan.total, plan.budget);
  const shown = Math.ceil(Math.min(1, sub * 1.3) * lines.length);
  const activities = plan.lines.find((l) => l.key === "activities")?.amount ?? 0;
  return (
    <div className="mgh-sheet">
      <p className="mgh-sheet__head">Lisbon · 4 days · where {money(plan.budget)} goes</p>
      <div className="mgh-stack">
        {lines.map((l, idx) => (
          <span key={l.key} style={{ width: idx < shown ? `${(l.amount / scale) * 100}%` : "0%", background: lineColours[l.key] }} />
        ))}
      </div>
      <ul className="mgh-lines">
        {lines.map((l, idx) => (
          <li key={l.key} className={idx < shown ? "is-in" : ""}>
            <i style={{ background: lineColours[l.key] }} />
            <span>{l.label}</span>
            <b>{money(l.amount)}</b>
          </li>
        ))}
      </ul>
      <p className="mgh-sheet__sum">
        <span>Estimated total</span>
        <b>{money(plan.total)}</b>
      </p>
      <p className="mgh-hand mgh-sheet__aside">{money(activities)} left for the good stuff</p>
    </div>
  );
}

const adaptSteps = [4000, 3400, 2800, 2200, 1600];
function FigAdapt({ sub, interactive }: { sub: number; interactive: boolean }) {
  const steps = useMemo(() => {
    const rich = { ...example, style: "comfort" as const, budget: adaptSteps[0] };
    const first = generate(rich);
    return adaptSteps.map((b) => {
      const inp = { ...rich, budget: b };
      const p = generate(inp);
      return { budget: b, plan: p, changes: b === adaptSteps[0] ? [] : diffPlans(first, p, rich, inp) };
    });
  }, []);
  const [manual, setManual] = useState(adaptSteps.length - 1);
  const idx = interactive ? manual : Math.min(steps.length - 1, Math.floor(sub * steps.length));
  const s = steps[idx];
  return (
    <div className="mgh-sheet mgh-sheet--adapt">
      <p className="mgh-sheet__head">Same trip, smaller budget</p>
      <div className="mgh-adapt__budget">
        <span>Budget</span>
        <b>{money(s.budget)}</b>
        <span className={`mg-badge mg-badge--${s.plan.status === "over" ? "over" : s.plan.status === "tight" ? "tight" : "fits"}`}>
          {s.plan.status === "over" ? "Doesn't fit yet" : s.plan.status === "tight" ? "Fits, just" : "Fits"}
        </span>
      </div>
      {interactive ? (
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={steps.length - 1 - manual}
          onChange={(e) => setManual(steps.length - 1 - +e.target.value)}
          aria-label="Example budget"
          aria-valuetext={money(s.budget)}
          className="mgh-adapt__range"
          style={{ direction: "rtl" }}
        />
      ) : (
        <span className="mgh-adapt__track">
          <b style={{ width: `${(1 - idx / (steps.length - 1)) * 100}%` }} />
        </span>
      )}
      <p className="mgh-adapt__stay">
        Staying at <strong>{s.plan.stay?.name ?? "—"}</strong> · total {money(s.plan.total)}
      </p>
      <ul className="mgh-adapt__changes">
        {s.changes.length === 0 ? (
          <li className="mgh-hand">nothing to change yet — try less money</li>
        ) : (
          s.changes.slice(0, 4).map((c) => (
            <li key={c.text} className={`mg-change mg-change--${c.tone}`}>
              {c.text}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ postcards */
function Postcards({ setInput }: { setInput: (f: (p: TripInput) => TripInput) => void }) {
  const ranked = useMemo(() => rankDestinations(defaultInput), []);
  const from = (id: string) => ranked.find((r) => r.dest.id === id)?.minimum;
  return (
    <section className="mgh-cards" aria-labelledby="mgh-cards-title">
      <header className="mgh-section-head">
        <Reveal as="p" kind="fade" className="mgh-eyebrow">
          The sample notebook
        </Reveal>
        <h2 id="mgh-cards-title">
          <SplitWords text="Six places to practise on." />
        </h2>
        <Reveal as="p" className="mgh-section-head__lede" delay={120}>
          Real cities and roads, with every price, duration and opening time written as an illustrative estimate. “From” figures are
          the engine's leanest version for two people from the US East Coast, four days in May.
        </Reveal>
      </header>
      <ul className="mgh-postcards">
        {destinations.map((d, i) => (
          <Reveal as="li" key={d.id} kind="rise" delay={(i % 3) * 110} className="mgh-postcard" style={{ "--d1": d.palette[0], "--d2": d.palette[1], "--d3": d.palette[2], "--tilt": `${[-1.2, 0.8, -0.4, 1, -0.9, 0.5][i]}deg` } as React.CSSProperties}>
            <div className="mgh-postcard__art" aria-hidden="true">
              <Motif d={d} />
              <span className="mgh-postcard__stamp">
                <small>from</small>
                {money(from(d.id) ?? 0)}
              </span>
            </div>
            <div className="mgh-postcard__body">
              <p className="mgh-postcard__country">{d.country}</p>
              <h3>{d.name}</h3>
              <p className="mgh-postcard__blurb">{d.blurb}</p>
              <button
                className="mg-textlink"
                onClick={() => {
                  setInput((p) => ({ ...p, destination: d.id, favorites: [], excluded: [], pinned: [], dayPace: {}, confirmed: {} }));
                  navigate(`${base}/plan`);
                }}
              >
                Start a page for {d.name.replace(/ &.*| coast road/, "")} <span aria-hidden="true">→</span>
              </button>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function Motif({ d }: { d: Destination }) {
  const [a, b, c] = d.palette;
  const seed = [...d.id].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const roof = ({ kyoto: "pagoda", "mexico-city": "dome" } as Record<string, string>)[d.id] ?? "flat";
  return (
    <svg viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="170" fill={c} />
      <circle cx="226" cy="54" r="30" fill={a} opacity="0.9" />
      {d.kind === "city" && (
        <g fill={b}>
          {Array.from({ length: 9 }, (_, i) => {
            const h = 34 + ((i * 37 + seed * 13) % 58);
            const x = i * 34;
            return (
              <g key={i} opacity={0.55 + ((i + seed) % 3) * 0.15}>
                <rect x={x} y={170 - h} width="30" height={h} />
                {roof === "pagoda" && <path d={`M${x - 4} ${170 - h} L${x + 15} ${158 - h} L${x + 34} ${170 - h}Z`} />}
                {roof === "dome" && i % 3 === 1 && <circle cx={x + 15} cy={170 - h} r="15" />}
              </g>
            );
          })}
          <path d="M0 150 H300 V170 H0Z" fill="#1c2540" opacity="0.12" />
        </g>
      )}
      {d.kind === "nature" && (
        <g>
          <path d="M0 170 L70 70 L120 120 L180 40 L260 130 L300 100 V170Z" fill={b} opacity="0.85" />
          <path d="M160 64 L180 40 L198 64 L188 60 L180 68 L170 60Z" fill="#fff" opacity="0.9" />
          <path d="M0 170 L60 120 L140 150 L220 118 L300 150 V170Z" fill={a} opacity="0.5" />
        </g>
      )}
      {d.kind === "coast" && (
        <g>
          <path d="M0 70 C 40 60, 80 90, 120 80 L150 170 H0Z" fill={a} opacity="0.75" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M120 ${100 + i * 18} C 160 ${92 + i * 18}, 200 ${108 + i * 18}, 240 ${100 + i * 18} S 290 ${96 + i * 18}, 310 ${102 + i * 18}`} stroke={b} strokeWidth="3" fill="none" opacity={0.8 - i * 0.15} />
          ))}
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ honesty */
function Wont() {
  const items: [string, string][] = [
    ["Book your flights and rooms", "it never books, pays or sends anything — “confirmed” just means you typed in what you paid"],
    ["Live prices", "every figure is a sample estimate written for this prototype"],
    ["An account", "saved trips stay in this browser, nowhere else"],
    ["Decide for you", "every swap is explained, and starred plans stay put"],
  ];
  return (
    <section className="mgh-wont" aria-labelledby="mgh-wont-title">
      <div className="mgh-wont__inner">
        <h2 id="mgh-wont-title">
          <SplitWords text="What Margin won't do." />
        </h2>
        <ul>
          {items.map(([k, v], i) => (
            <Reveal as="li" key={k} delay={i * 90}>
              <s>{k}</s>
              <span className="mgh-hand">{v}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
