import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/caveat/500.css";
import { usePersistentState } from "../../lib/storage";
import { href, navigate } from "../../lib/router";
import { defaultInput, diffPlans, generate, packingList, type Change, type Plan, type TripInput } from "./engine";
import { destinationById } from "./data";
import { Onboarding } from "./Onboarding";
import { Discover } from "./Discover";
import { TripView } from "./TripView";
import { Trips } from "./Trips";
import { Home } from "./Home";
import { Reveal, SplitWords, useScrolled } from "../../lib/scroll";
import { prefersReducedMotion } from "../../lib/motion";
import "./margin.css";

export interface SavedTrip {
  id: string;
  name: string;
  createdAt: number;
  input: TripInput;
  plan: Plan;
  checks: Record<string, boolean>;
}

export const base = "/work/margin";

export const prepTasks = [
  "Check passport / ID validity",
  "Book transport there & back",
  "Book where you'll stay",
  "Book timed tickets you can't miss",
  "Tell your bank you're travelling",
  "Download offline maps",
];

export default function Margin({ path }: { path: string[] }) {
  const view = path[0] ?? "home";
  const [input, setInput] = usePersistentState<TripInput>("mg.draft", defaultInput);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [trips, setTrips] = usePersistentState<SavedTrip[]>("mg.trips", []);
  const [tripId, setTripId] = useState<string | null>(null);
  const baseline = useRef<{ plan: Plan; input: TripInput } | null>(null);
  const settle = useRef<number>(0);
  const scrolled = useScrolled(24);

  // Reopening a saved trip from the dashboard.
  useEffect(() => {
    if (view === "trip" && path[1]) {
      const t = trips.find((x) => x.id === path[1]);
      if (t && t.id !== tripId) {
        setTripId(t.id);
        setInput(t.input);
        setPlan(t.plan);
        setChanges([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, path[1]]);

  useEffect(() => {
    if (view === "trip" && !plan && !path[1]) navigate(`${base}/plan`, { replace: true });
  }, [view, plan, path]);

  const start = useCallback(
    (destinationId: string) => {
      const next = { ...input, destination: destinationId };
      setInput(next);
      setPlan(generate(next));
      setChanges([]);
      setTripId(null);
      navigate(`${base}/trip`);
    },
    [input, setInput],
  );

  /** The adaptive core: change a preference, rebuild the trip, explain what moved. */
  const adapt = useCallback(
    (patch: Partial<TripInput>) => {
      if (!plan) return;
      if (!baseline.current) baseline.current = { plan, input };
      const next = { ...input, ...patch };
      const rebuilt = generate(next);
      setInput(next);
      setPlan(rebuilt);
      setChanges(diffPlans(baseline.current.plan, rebuilt, baseline.current.input, next));
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => (baseline.current = null), 1400);
    },
    [plan, input, setInput],
  );

  const edit = useCallback(
    (nextPlan: Plan, nextInput?: TripInput) => {
      setPlan(nextPlan);
      if (nextInput) setInput(nextInput);
      setChanges([]);
    },
    [setInput],
  );

  const save = (name?: string) => {
    if (!plan) return;
    const dest = destinationById(plan.destinationId)!;
    const existing = trips.find((t) => t.id === tripId);
    const entry: SavedTrip = {
      id: existing?.id ?? `${Date.now()}`,
      name: name ?? existing?.name ?? `${dest.name}, ${plan.effectiveDays} days`,
      createdAt: existing?.createdAt ?? Date.now(),
      input,
      plan,
      checks: existing?.checks ?? {},
    };
    setTrips((list) => [entry, ...list.filter((t) => t.id !== entry.id)]);
    setTripId(entry.id);
    return entry;
  };

  const current = useMemo(() => trips.find((t) => t.id === tripId) ?? null, [trips, tripId]);
  const packing = plan ? packingList(input, plan) : [];

  let screen: React.ReactNode;
  if (view === "plan") screen = <Onboarding input={input} setInput={setInput} onDone={(i) => (i.destination === "suggest" ? navigate(`${base}/discover`) : start(i.destination))} />;
  else if (view === "discover") screen = <Discover input={input} setInput={setInput} onChoose={start} />;
  else if (view === "trip" && plan)
    screen = (
      <TripView
        input={input}
        plan={plan}
        changes={changes}
        adapt={adapt}
        edit={edit}
        packing={packing}
        saved={current}
        onSave={save}
        onToggleCheck={(key) => current && setTrips((list) => list.map((t) => (t.id === current.id ? { ...t, checks: { ...t.checks, [key]: !t.checks[key] } } : t)))}
        onDismissChanges={() => setChanges([])}
      />
    );
  else if (view === "trips")
    screen = (
      <Trips
        trips={trips}
        onOpen={(t) => navigate(`${base}/trip/${t.id}`)}
        onDelete={(id) => setTrips((list) => list.filter((t) => t.id !== id))}
        onRename={(id, name) => setTrips((list) => list.map((t) => (t.id === id ? { ...t, name } : t)))}
        onToggle={(id, key) => setTrips((list) => list.map((t) => (t.id === id ? { ...t, checks: { ...t.checks, [key]: !t.checks[key] } } : t)))}
      />
    );
  else screen = <Home trips={trips.length} setInput={setInput} />;

  // a new page of the journal: start at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <div className={`mg mg--${view}`}>
      <a className="mg-skip" href="#mg-main" onClick={(e) => (e.preventDefault(), document.getElementById("mg-main")?.focus())}>
        Skip to content
      </a>
      <header className={`mg-bar ${scrolled ? "is-scrolled" : ""}`}>
        <a className="mg-mark" href={href(base)} aria-label="Margin, home">
          <span className="mg-mark__rule" aria-hidden="true" />
          Margin
          <span className="mg-mark__tag" aria-hidden="true">
            concept
          </span>
        </a>
        <nav aria-label="Margin">
          <a href={href(`${base}/plan`)} aria-current={view === "plan" || view === "discover" ? "page" : undefined}>
            Plan a trip
          </a>
          {plan && (
            <a href={href(`${base}/trip${tripId ? `/${tripId}` : ""}`)} aria-current={view === "trip" ? "page" : undefined}>
              Current trip
            </a>
          )}
          <a href={href(`${base}/trips`)} aria-current={view === "trips" ? "page" : undefined}>
            Your trips {trips.length > 0 && <span className="mg-count">{trips.length}</span>}
          </a>
        </nav>
      </header>
      <p className="mg-proto">
        <span className="mg-proto__dot" aria-hidden="true" />
        Prototype · sample destinations and illustrative prices · nothing is booked
      </p>
      <main id="mg-main" tabIndex={-1} className={`mg-main ${view === "home" ? "mg-main--wide" : ""}`}>
        <div key={view} className="mg-page">
          {screen}
        </div>
      </main>
      <Footer trips={trips.length} />
    </div>
  );
}

function Footer({ trips }: { trips: number }) {
  return (
    <footer className="mg-foot">
      <div className="mg-foot__perf" aria-hidden="true" />
      <div className="mg-foot__inner">
        <div className="mg-foot__lead">
          <p className="mg-foot__hand">p.s.</p>
          <p className="mg-foot__line">
            <SplitWords text="Leave room" />
            <br />
            <SplitWords text="for the unplanned." className="mg-foot__ital" delay={160} />
          </p>
          <Reveal className="mg-foot__cta" delay={300}>
            <a className="mg-btn mg-btn--light mg-btn--arrow" href={href(`${base}/plan`)}>
              Start a trip page <span aria-hidden="true">→</span>
            </a>
            {trips > 0 && (
              <a className="mg-btn mg-btn--ghost-light" href={href(`${base}/trips`)}>
                Your trips ({trips})
              </a>
            )}
          </Reveal>
        </div>
        <div className="mg-foot__stub" aria-label="About this concept">
          <p className="mg-foot__stamp" aria-hidden="true">
            <span>Margin</span>
            <small>sample edition</small>
          </p>
          <dl>
            <div>
              <dt>What it is</dt>
              <dd>A self-initiated concept for a personalised travel planner.</dd>
            </div>
            <div>
              <dt>The data</dt>
              <dd>Six sample destinations. Every price is an illustrative estimate.</dd>
            </div>
            <div>
              <dt>Your trips</dt>
              <dd>Stay in this browser. Nothing is booked, sent or shared.</dd>
            </div>
          </dl>
          <button
            className="mg-textlink mg-textlink--light"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
              document.getElementById("mg-main")?.focus({ preventScroll: true });
            }}
          >
            Back to the first page <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
