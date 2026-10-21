import { useState } from "react";
import { destinations, interestColours, interestLabels, originLabels, type Interest, type Origin } from "./data";
import { effectiveDays, minimumCost, money, rankDestinations, type Pace, type Style, type TripInput } from "./engine";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const steps = [
  { id: "trip", title: "The trip" },
  { id: "budget", title: "The budget" },
  { id: "style", title: "What you enjoy" },
  { id: "life", title: "Your life (optional)" },
] as const;

interface Props {
  input: TripInput;
  setInput: (i: TripInput | ((p: TripInput) => TripInput)) => void;
  onDone: (i: TripInput) => void;
}

export function Onboarding({ input, setInput, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<TripInput>) => {
    setError(null);
    // answers changed: earlier hand edits no longer apply
    setInput((p) => ({ ...p, ...patch, favorites: [], excluded: [], pinned: [], dayPace: {}, confirmed: {} }));
  };

  const next = () => {
    if (step === 1 && (!input.budget || input.budget < 50)) return setError("Enter a budget of at least $50.");
    if (step === 2 && input.interests.length === 0) return setError("Pick at least one thing you enjoy — or two, or five.");
    if (step < steps.length - 1) setStep(step + 1);
    else onDone(input);
  };

  return (
    <div className="mg-onboard">
      <section className="mg-card mg-q" aria-labelledby="mg-q-title">
        <ol className="mg-steps" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s.id} className={i === step ? "is-now" : i < step ? "is-done" : ""}>
              <button onClick={() => i < step && setStep(i)} disabled={i > step} aria-current={i === step ? "step" : undefined}>
                <span>{i + 1}</span> {s.title}
              </button>
            </li>
          ))}
        </ol>
        <p className="mg-q__note" aria-hidden="true" key={`n${step}`}>
          {["start with the outline", "everything, travel included", "pick freely — it only leans", "skip anything, really"][step]}
        </p>
        <h1 id="mg-q-title" className="mg-q__title" key={`t${step}`}>
          {["Where from, and for how long?", "What can you spend?", "What makes a trip good for you?", "What does your life allow?"][step]}
        </h1>

        {step === 0 && (
          <div className="mg-fields" key="f0">
            <label className="mg-field">
              <span>Starting from</span>
              <select value={input.origin} onChange={(e) => set({ origin: e.target.value as Origin })}>
                {Object.entries(originLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="mg-field">
              <legend>Destination</legend>
              <div className="mg-radios">
                <label className={input.destination === "suggest" ? "is-on" : ""}>
                  <input type="radio" name="dest" checked={input.destination === "suggest"} onChange={() => set({ destination: "suggest" })} />
                  Suggest places for me
                </label>
                {destinations.map((d) => (
                  <label key={d.id} className={input.destination === d.id ? "is-on" : ""}>
                    <input type="radio" name="dest" checked={input.destination === d.id} onChange={() => set({ destination: d.id })} />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {input.destination === "suggest" && (
              <fieldset className="mg-field">
                <legend>Stay in your country?</legend>
                <div className="mg-seg">
                  {(
                    [
                      ["any", "Either"],
                      ["domestic", "Domestic"],
                      ["international", "International"],
                    ] as const
                  ).map(([v, l]) => (
                    <label key={v} className={input.scope === v ? "is-on" : ""}>
                      <input type="radio" name="scope" checked={input.scope === v} onChange={() => set({ scope: v })} />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="mg-row">
              <label className="mg-field">
                <span>When</span>
                <select value={input.month} onChange={(e) => set({ month: +e.target.value })}>
                  {months.map((m, i) => (
                    <option key={m} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <Stepper label="Days" value={input.days} min={1} max={14} onChange={(v) => set({ days: v })} />
              <Stepper label="Travellers" value={input.travelers} min={1} max={8} onChange={(v) => set({ travelers: v })} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mg-fields" key="f1">
            <label className="mg-field mg-field--money">
              <span>Total budget for everyone (USD)</span>
              <input type="number" inputMode="numeric" min={50} step={50} value={input.budget || ""} onChange={(e) => set({ budget: Math.max(0, +e.target.value) })} />
              <input type="range" min={300} max={10000} step={50} value={Math.min(10000, input.budget)} onChange={(e) => set({ budget: +e.target.value })} aria-label="Budget slider" />
            </label>
            <label className="mg-check">
              <input type="checkbox" checked={input.budgetIncludesTravel} onChange={(e) => set({ budgetIncludesTravel: e.target.checked })} />
              This includes getting there and back
            </label>
            <fieldset className="mg-field">
              <legend>How do you like to spend?</legend>
              <div className="mg-cards3">
                {(
                  [
                    ["shoestring", "Shoestring", "Hostels, markets, free museums."],
                    ["balanced", "Balanced", "Comfortable, a few treats."],
                    ["comfort", "Comfort", "Nice hotels, good dinners."],
                  ] as [Style, string, string][]
                ).map(([v, l, d]) => (
                  <label key={v} className={input.style === v ? "is-on" : ""}>
                    <input type="radio" name="style" checked={input.style === v} onChange={() => set({ style: v })} />
                    <strong>{l}</strong>
                    <span>{d}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mg-field">
              <legend>Keep a safety buffer?</legend>
              <div className="mg-seg">
                {([0, 5, 10] as const).map((v) => (
                  <label key={v} className={input.contingency === v ? "is-on" : ""}>
                    <input type="radio" name="buffer" checked={input.contingency === v} onChange={() => set({ contingency: v })} />
                    {v ? `${v}%` : "No buffer"}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="mg-fields" key="f2">
            <p className="mg-hint">Pick as many as you like. The plan leans toward what you choose.</p>
            <div className="mg-interests" role="group" aria-label="Interests">
              {(Object.keys(interestLabels) as Interest[]).map((k) => {
                const on = input.interests.includes(k);
                return (
                  <button
                    key={k}
                    className="mg-interest"
                    aria-pressed={on}
                    style={{ "--c": interestColours[k] } as React.CSSProperties}
                    onClick={() => set({ interests: on ? input.interests.filter((x) => x !== k) : [...input.interests, k] })}
                  >
                    {interestLabels[k]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mg-fields" key="f3">
            <p className="mg-hint">All optional. Skip anything that doesn't matter to you — you can change it later from the trip.</p>
            <div className="mg-row">
              <label className="mg-field">
                <span>Vacation days available</span>
                <input type="number" min={0} max={30} placeholder="No limit" value={input.vacationDays ?? ""} onChange={(e) => set({ vacationDays: e.target.value === "" ? null : Math.max(0, +e.target.value) })} />
              </label>
              <label className="mg-field">
                <span>Most walking per day</span>
                <select value={input.maxWalk} onChange={(e) => set({ maxWalk: +e.target.value })}>
                  {[45, 90, 150, 240, 360].map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} minutes` : `${m / 60} hours`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="mg-field">
              <legend>Pace</legend>
              <div className="mg-seg">
                {(["relaxed", "balanced", "packed"] as Pace[]).map((v) => (
                  <label key={v} className={input.pace === v ? "is-on" : ""}>
                    <input type="radio" name="pace" checked={input.pace === v} onChange={() => set({ pace: v })} />
                    {v[0].toUpperCase() + v.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mg-row">
              <fieldset className="mg-field">
                <legend>Days should be</legend>
                <div className="mg-seg">
                  {(
                    [
                      ["structured", "Planned"],
                      ["flexible", "Loose"],
                    ] as const
                  ).map(([v, l]) => (
                    <label key={v} className={input.structure === v ? "is-on" : ""}>
                      <input type="radio" name="structure" checked={input.structure === v} onChange={() => set({ structure: v })} />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mg-field">
                <legend>Getting around</legend>
                <div className="mg-seg">
                  {(
                    [
                      ["transit", "Walk & transit"],
                      ["car", "Car"],
                    ] as const
                  ).map(([v, l]) => (
                    <label key={v} className={input.transport === v ? "is-on" : ""}>
                      <input type="radio" name="transport" checked={input.transport === v} onChange={() => set({ transport: v })} />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <label className="mg-field">
              <span>Where you like to sleep</span>
              <select value={input.stayPref} onChange={(e) => set({ stayPref: e.target.value as TripInput["stayPref"] })}>
                <option value="any">No preference</option>
                <option value="hostel">Hostel</option>
                <option value="hotel">Hotel or guesthouse</option>
                <option value="apartment">Apartment</option>
                <option value="cabin">Cabin</option>
              </select>
            </label>
            <label className="mg-check">
              <input type="checkbox" checked={input.earlyStarts} onChange={(e) => set({ earlyStarts: e.target.checked })} />
              Early starts are fine
            </label>
            <label className="mg-check">
              <input type="checkbox" checked={input.stepFree} onChange={(e) => set({ stepFree: e.target.checked })} />
              I need step-free access
            </label>
            <fieldset className="mg-field">
              <legend>Food needs</legend>
              <div className="mg-seg mg-seg--wrap">
                {(["vegetarian", "vegan", "gluten-free", "halal"] as const).map((d) => (
                  <label key={d} className={input.diet.includes(d) ? "is-on" : ""}>
                    <input type="checkbox" checked={input.diet.includes(d)} onChange={() => set({ diet: input.diet.includes(d) ? input.diet.filter((x) => x !== d) : [...input.diet, d] })} />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mg-fine">Access and food answers are only used to filter suggestions, and stay in this browser.</p>
          </div>
        )}

        {error && (
          <p className="mg-error" role="alert">
            {error}
          </p>
        )}
        <div className="mg-actions">
          {step > 0 && (
            <button className="mg-btn mg-btn--quiet" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button className="mg-btn" onClick={next}>
            {step < steps.length - 1 ? "Continue" : input.destination === "suggest" ? "Find trips that fit" : "Build my trip"}
          </button>
          {step === steps.length - 1 && (
            <button className="mg-textbtn" onClick={() => onDone(input)}>
              Skip — use sensible defaults
            </button>
          )}
        </div>
      </section>
      <Ticket input={input} />
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="mg-field">
      <span id={`st-${label}`}>{label}</span>
      <div className="mg-stepper" role="group" aria-labelledby={`st-${label}`}>
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}

/** The live summary: a boarding-pass-like ticket that fills in as you answer. */
function Ticket({ input }: { input: TripInput }) {
  const ranked = rankDestinations(input);
  const dest = input.destination === "suggest" ? ranked[0]?.dest : destinations.find((d) => d.id === input.destination);
  const min = dest ? minimumCost(input, dest) : 0;
  const days = effectiveDays(input);
  const pct = Math.min(100, (min / Math.max(1, input.budget)) * 100);
  return (
    <aside className="mg-ticket" aria-label="Trip summary so far">
      <div className="mg-ticket__top" style={{ background: dest?.palette[0] }}>
        <span>{originLabels[input.origin]}</span>
        <span aria-hidden="true">→</span>
        <span>{input.destination === "suggest" ? "Somewhere that fits" : dest?.name}</span>
      </div>
      <dl className="mg-ticket__grid">
        <div>
          <dt>When</dt>
          <dd>{months[input.month]}</dd>
        </div>
        <div>
          <dt>Days</dt>
          <dd>{days}</dd>
        </div>
        <div>
          <dt>People</dt>
          <dd>{input.travelers}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{money(input.budget)}</dd>
        </div>
      </dl>
      {dest && (
        <div className="mg-ticket__fit">
          <p>
            {input.destination === "suggest" ? `Best match so far: ${dest.name}. ` : ""}
            The leanest version of this trip is about <strong>{money(min)}</strong> — {min <= input.budget ? `that leaves ${money(input.budget - min)} to shape it.` : "more than your budget. We'll show options."}
          </p>
          <span className="mg-meter" aria-hidden="true">
            <b style={{ width: `${pct}%`, background: min <= input.budget ? "#4f7a5a" : "#b04a4a" }} />
          </span>
          <p className="mg-fine">Estimate from sample data.</p>
        </div>
      )}
      <ul className="mg-ticket__tags">
        {input.interests.map((i) => (
          <li key={i} style={{ background: interestColours[i] }}>
            {interestLabels[i]}
          </li>
        ))}
      </ul>
      <span className="mg-ticket__stub" aria-hidden="true">
        <span>Admit {input.travelers}</span>
        <span>Margin · draft</span>
      </span>
    </aside>
  );
}
