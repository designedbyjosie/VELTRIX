import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import { usePersistentState } from "../../lib/storage";
import { href, navigate } from "../../lib/router";
import { defaultInput, diffPlans, generate, packingList, type Change, type Plan, type TripInput } from "./engine";
import { destinationById } from "./data";
import { Onboarding } from "./Onboarding";
import { Discover } from "./Discover";
import { TripView } from "./TripView";
import { Trips } from "./Trips";
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
  else screen = <Home trips={trips.length} />;

  return (
    <div className="mg">
      <header className="mg-bar">
        <a className="mg-mark" href={href(base)}>
          Margin
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
      <p className="mg-proto">Prototype · sample destinations and illustrative prices · nothing is booked</p>
      <main className="mg-main">{screen}</main>
    </div>
  );
}

function Home({ trips }: { trips: number }) {
  return (
    <section className="mg-home">
      <div className="mg-home__copy">
        <h1>Trips that fit in the margins of your life.</h1>
        <p className="mg-lede">
          Tell Margin what you can spend, how many days you really have and how you like to travel. It builds a realistic
          day-by-day plan around you — and rebuilds it, out loud, whenever something changes.
        </p>
        <div className="mg-actions">
          <a className="mg-btn" href={href(`${base}/plan`)}>
            Plan a trip
          </a>
          {trips > 0 && (
            <a className="mg-btn mg-btn--quiet" href={href(`${base}/trips`)}>
              Open your trips ({trips})
            </a>
          )}
        </div>
      </div>
      <ol className="mg-home__how" aria-label="How it works">
        <li>
          <strong>Your life first.</strong> Budget, days off, pace, walking, diet and access needs — only what's useful, and
          most of it optional.
        </li>
        <li>
          <strong>The real budget.</strong> Getting there, sleeping, eating and getting around come out before a single
          ticket is chosen.
        </li>
        <li>
          <strong>A plan that adapts.</strong> Lower the budget and the stay changes, paid activities give way to free
          ones, and you see each swap.
        </li>
      </ol>
    </section>
  );
}
