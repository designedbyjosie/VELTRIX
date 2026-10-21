import { useEffect, useRef, useState } from "react";
import { destinationById, interestColours, interestLabels, type Activity, type Destination, type Interest } from "./data";
import { diffPlans, money, recomputeTimes, regenerateDay, retotal, transportNote, type BudgetLine, type Change, type DayPlan, type Item, type Pace, type Plan, type TripInput } from "./engine";
import { prepTasks, type SavedTrip } from "./Margin";
import { SplitWords } from "../../lib/scroll";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const basisLabel = { estimate: "Estimate", yours: "Your figure", confirmed: "Confirmed" } as const;
const lineColours: Record<string, string> = {
  travel: "#3d6fb6",
  stay: "#6b4fa0",
  food: "#c2577a",
  local: "#5ba8a0",
  activities: "#e8a33d",
  misc: "#8c6d46",
  buffer: "#9aa3b5",
};

interface Props {
  input: TripInput;
  plan: Plan;
  changes: Change[];
  adapt: (patch: Partial<TripInput>) => void;
  edit: (plan: Plan, input?: TripInput) => void;
  packing: string[];
  saved: SavedTrip | null;
  onSave: (name?: string) => SavedTrip | undefined;
  onToggleCheck: (key: string) => void;
  onDismissChanges: () => void;
}

export function TripView(props: Props) {
  const { input, plan, changes, adapt, saved } = props;
  const dest = destinationById(plan.destinationId)!;
  const [tab, setTab] = useState<"plan" | "journal">("plan");
  const [day, setDay] = useState(0);
  const [budgetDraft, setBudgetDraft] = useState(input.budget);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => setBudgetDraft(input.budget), [input.budget]);
  useEffect(() => {
    if (day >= plan.days.length) setDay(Math.max(0, plan.days.length - 1));
  }, [plan.days.length, day]);

  const style = { "--d1": dest.palette[0], "--d2": dest.palette[1], "--d3": dest.palette[2] } as React.CSSProperties;

  return (
    <div className="mg-trip" style={style}>
      <header className="mg-cover">
        <div className="mg-cover__text">
          <p className="mg-cover__kicker">
            {months[input.month]} · {plan.effectiveDays} days · {input.travelers} {input.travelers === 1 ? "traveller" : "travellers"} · {input.pace} pace
          </p>
          <h1>
            <SplitWords key={dest.id} text={dest.name} stagger={80} />
          </h1>
          <p className="mg-cover__blurb">{dest.blurb}</p>
        </div>
        <svg className="mg-cover__map" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M-5 ${18 + i * 12} C 20 ${10 + i * 13}, 45 ${30 + i * 11}, 70 ${16 + i * 12} S 100 ${12 + i * 12}, 110 ${22 + i * 11}`} />
          ))}
        </svg>
        <span className="mg-postmark" aria-hidden="true">
          <b>{months[input.month].slice(0, 3)}</b>
          <small>{dest.country}</small>
        </span>
        <div className="mg-cover__side">
          <span className="mg-stamp">Estimated plan · not booked</span>
          <div className="mg-cover__save">
            <button
              className="mg-btn"
              onClick={() => {
                const t = props.onSave();
                if (t) setSavedMsg(saved ? `Updated “${t.name}”` : `Saved as “${t.name}”`);
              }}
            >
              {saved ? "Save changes" : "Save trip"}
            </button>
            <span role="status" className="mg-fine">
              {savedMsg ?? (saved ? `Saved as “${saved.name}”` : "Not saved yet")}
            </span>
          </div>
        </div>
      </header>

      <Adapt input={input} plan={plan} adapt={adapt} budgetDraft={budgetDraft} setBudgetDraft={setBudgetDraft} />

      {changes.length > 0 && (
        <section className="mg-changes" aria-live="polite" aria-label="What changed">
          <div className="mg-changes__head">
            <h2>
              What changed <span className="mg-changes__hand" aria-hidden="true">— written in the margin</span>
            </h2>
            <button className="mg-textbtn" onClick={props.onDismissChanges}>
              Dismiss
            </button>
          </div>
          <ul>
            {changes.map((c, i) => (
              <li key={i} className={`mg-change mg-change--${c.tone}`}>
                {c.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Status plan={plan} adapt={adapt} />

      <div className="mg-tabs" role="tablist" aria-label="Trip views">
        <button role="tab" aria-selected={tab === "plan"} onClick={() => setTab("plan")}>
          Day by day
        </button>
        <button role="tab" aria-selected={tab === "journal"} onClick={() => setTab("journal")}>
          Trip journal
        </button>
      </div>

      {tab === "plan" ? (
        <div className="mg-plan">
          <div className="mg-plan__main">
            <DayNav plan={plan} day={day} setDay={setDay} />
            {plan.days[day] && <DayView key={day} dest={dest} plan={plan} input={input} day={plan.days[day]} edit={props.edit} />}
          </div>
          <BudgetPanel plan={plan} input={input} adapt={adapt} />
        </div>
      ) : (
        <Journal {...props} dest={dest} />
      )}
    </div>
  );
}

/* ---------------- the signature: preferences that reshape the trip ---------------- */
function Adapt({ input, plan, adapt, budgetDraft, setBudgetDraft }: { input: TripInput; plan: Plan; adapt: Props["adapt"]; budgetDraft: number; setBudgetDraft: (n: number) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <section className="mg-adapt" aria-label="Adjust the trip">
      <div className="mg-adapt__budget">
        <label htmlFor="mg-budget-range">
          Budget <strong>{money(budgetDraft)}</strong>
        </label>
        <input
          id="mg-budget-range"
          type="range"
          min={300}
          max={Math.max(10000, input.budget)}
          step={50}
          value={budgetDraft}
          onChange={(e) => {
            setBudgetDraft(+e.target.value);
            adapt({ budget: +e.target.value });
          }}
          aria-valuetext={money(budgetDraft)}
        />
        <span className="mg-adapt__scale" aria-hidden="true">
          <span>{money(300)}</span>
          <span className="mg-adapt__marker" style={{ left: `${Math.min(100, (plan.total / Math.max(10000, input.budget)) * 100)}%` }}>
            trip ≈ {money(plan.total)}
          </span>
          <span>{money(Math.max(10000, input.budget))}</span>
        </span>
      </div>
      <div className="mg-adapt__row">
        <div className="mg-field">
          <span id="mg-days-l">Days</span>
          <div className="mg-stepper" role="group" aria-labelledby="mg-days-l">
            <button onClick={() => adapt({ days: Math.max(1, input.days - 1), dayPace: {} })} disabled={input.days <= 1} aria-label="One day fewer">
              −
            </button>
            <output>{plan.effectiveDays}</output>
            <button onClick={() => adapt({ days: Math.min(14, input.days + 1), dayPace: {} })} disabled={input.days >= 14} aria-label="One more day">
              +
            </button>
          </div>
        </div>
        <fieldset className="mg-field">
          <legend>Pace</legend>
          <div className="mg-seg">
            {(["relaxed", "balanced", "packed"] as Pace[]).map((p) => (
              <label key={p} className={input.pace === p ? "is-on" : ""}>
                <input type="radio" name="adapt-pace" checked={input.pace === p} onChange={() => adapt({ pace: p, dayPace: {} })} />
                {p[0].toUpperCase() + p.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mg-field">
          <legend>Spending</legend>
          <div className="mg-seg">
            {(["shoestring", "balanced", "comfort"] as const).map((s) => (
              <label key={s} className={input.style === s ? "is-on" : ""}>
                <input type="radio" name="adapt-style" checked={input.style === s} onChange={() => adapt({ style: s })} />
                {s[0].toUpperCase() + s.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="mg-textbtn" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
          {moreOpen ? "Hide interests" : "Change interests"}
        </button>
      </div>
      {moreOpen && (
        <div className="mg-interests mg-interests--small" role="group" aria-label="Interests">
          {(Object.keys(interestLabels) as Interest[]).map((k) => {
            const on = input.interests.includes(k);
            return (
              <button
                key={k}
                className="mg-interest"
                aria-pressed={on}
                style={{ "--c": interestColours[k] } as React.CSSProperties}
                onClick={() => {
                  const next = on ? input.interests.filter((x) => x !== k) : [...input.interests, k];
                  if (next.length) adapt({ interests: next });
                }}
              >
                {interestLabels[k]}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Status({ plan, adapt }: { plan: Plan; adapt: Props["adapt"] }) {
  const left = plan.budget - plan.total;
  return (
    <section className={`mg-status mg-status--${plan.status}`} aria-live="polite">
      <p className="mg-status__headline">
        {plan.status === "over"
          ? `This trip doesn't fit ${money(plan.budget)} yet — it needs about ${money(plan.total)}.`
          : plan.status === "tight"
            ? `It fits, just: ${money(left)} to spare.`
            : `It fits, with ${money(left)} to spare.`}
      </p>
      {plan.notes.length > 0 && (
        <ul className="mg-status__notes">
          {plan.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {plan.suggestions.length > 0 && (
        <div className="mg-status__options">
          <p>Ways to make it work:</p>
          {plan.suggestions.map((s) => (
            <button key={s.label} className="mg-btn mg-btn--quiet" onClick={() => adapt({ ...s.apply, dayPace: {} })}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function DayNav({ plan, day, setDay }: { plan: Plan; day: number; setDay: (n: number) => void }) {
  return (
    <nav className="mg-daynav" aria-label="Days">
      {plan.days.map((d) => {
        const cost = d.items.reduce((s, i) => s + i.cost, 0);
        const label = d.kind === "arrival" ? "Arrive" : d.kind === "departure" ? "Leave" : `${d.items.filter((i) => i.kind === "activity").length} plans`;
        return (
          <button key={d.index} aria-current={day === d.index ? "true" : undefined} onClick={() => setDay(d.index)}>
            <span className="mg-daynav__n">Day {d.index + 1}</span>
            <span className="mg-daynav__meta">
              {label} · {cost ? money(cost) : "free"}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function DayView({ dest, plan, input, day, edit }: { dest: Destination; plan: Plan; input: TripInput; day: DayPlan; edit: Props["edit"] }) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const [noting, setNoting] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [dayDiff, setDayDiff] = useState<Change[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const zone = dest.zones.find((z) => z.id === day.zone);
  const activities = day.items.filter((i) => i.kind === "activity");
  const walk = day.items.reduce((s, i) => s + i.walk, 0);
  const cost = day.items.reduce((s, i) => s + i.cost, 0);

  const replaceDay = (items: Item[], nextInput?: TripInput, message?: string) => {
    const d = { ...day, items };
    recomputeTimes(d, nextInput ?? input);
    // refresh transport notes
    let prev: string | null = null;
    d.items.forEach((i) => {
      i.transport = prev && i.kind !== "rest" ? transportNote(dest, prev, i.zone, input.transport) : undefined;
      prev = i.zone;
    });
    edit(retotal({ ...plan, days: plan.days.map((x) => (x.index === day.index ? d : x)) }, nextInput ?? input), nextInput);
    setDayDiff([]);
    if (message) setAnnounce(message);
  };

  const act = (id?: string) => dest.activities.find((a) => a.id === id);

  const remove = (item: Item) => {
    const nextInput = item.activityId
      ? { ...input, excluded: [...input.excluded, item.activityId], favorites: input.favorites.filter((f) => f !== item.activityId), pinned: input.pinned.filter((p) => p.id !== item.activityId) }
      : input;
    replaceDay(day.items.filter((i) => i.uid !== item.uid), nextInput, `Removed ${item.title}`);
  };

  const swap = (item: Item, a: Activity) => {
    const next: Item = {
      ...item,
      uid: `${a.id}@${item.slot}`,
      kind: "activity",
      activityId: a.id,
      title: a.name,
      detail: a.detail,
      hours: a.hours,
      cost: a.cost * input.travelers,
      walk: a.walk,
      zone: a.zone,
      open: a.open,
      interests: a.interests,
      alternatives: item.alternatives.filter((x) => x !== a.id).concat(item.activityId ? [item.activityId] : []),
    };
    const nextInput = {
      ...input,
      pinned: [...input.pinned.filter((p) => p.id !== item.activityId), { id: a.id, day: day.index }],
    };
    setReplacing(null);
    replaceDay(day.items.map((i) => (i.uid === item.uid ? next : i)), nextInput, `Replaced ${item.title} with ${a.name}`);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const items = [...day.items];
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    // keep slots in time order: swap slots too
    const s = items[idx].slot;
    items[idx] = { ...items[idx], slot: items[j].slot };
    items[j] = { ...items[j], slot: s };
    replaceDay(items, undefined, `Moved ${day.items[idx].title} ${dir < 0 ? "earlier" : "later"}`);
  };

  const favorite = (item: Item) => {
    if (!item.activityId) return;
    const on = input.favorites.includes(item.activityId);
    const nextInput = {
      ...input,
      favorites: on ? input.favorites.filter((f) => f !== item.activityId) : [...input.favorites, item.activityId],
      pinned: on ? input.pinned.filter((p) => p.id !== item.activityId) : [...input.pinned.filter((p) => p.id !== item.activityId), { id: item.activityId, day: day.index }],
    };
    edit(plan, nextInput);
    setAnnounce(on ? `Unstarred ${item.title}` : `Starred ${item.title} — it stays when the trip changes`);
  };

  const setNote = (item: Item, text: string) => {
    const key = item.activityId ?? item.uid;
    edit(plan, { ...input, notes: { ...input.notes, [key]: text } });
  };

  /** Rebuild this day and keep a note of exactly what moved. */
  const rebuild = (next: Plan, nextInput: TripInput | undefined, message: string) => {
    const prefix = `Day ${day.index + 1}:`;
    const moved = diffPlans(plan, next, input, nextInput ?? input).filter((c) => c.text.startsWith(prefix) || c.text.includes(`day ${day.index + 1}`));
    edit(next, nextInput);
    setDayDiff(moved.length ? moved.map((c) => {
            const t = c.text.replace(prefix, "").trim();
            return { ...c, text: t[0].toUpperCase() + t.slice(1) };
          }) : [{ tone: "neutral", text: "Same picks — nothing else fits this day right now." }]);
    setAnnounce(message);
  };

  const setPace = (p: Pace) => {
    const nextInput = { ...input, dayPace: { ...input.dayPace, [day.index]: p } };
    rebuild(regenerateDay(plan, nextInput, day.index, p), nextInput, `Day ${day.index + 1} rebuilt at a ${p} pace`);
  };

  return (
    <section className="mg-day" aria-labelledby={`day-${day.index}`}>
      <header className="mg-day__head">
        <div>
          <h2 id={`day-${day.index}`} ref={headingRef} tabIndex={-1}>
            Day {day.index + 1}
            <span>{day.kind === "arrival" ? "Arrival" : day.kind === "departure" ? "Heading home" : zone?.name}</span>
          </h2>
          <p className="mg-fine">
            {activities.length} planned · about {walk} min on foot · {cost ? money(cost) : "no paid activities"}
          </p>
        </div>
        <div className="mg-day__tools">
          <label className="mg-inline">
            Pace
            <select value={day.pace} onChange={(e) => setPace(e.target.value as Pace)}>
              <option value="relaxed">Relaxed</option>
              <option value="balanced">Balanced</option>
              <option value="packed">Packed</option>
            </select>
          </label>
          <button
            className="mg-btn mg-btn--quiet"
            onClick={() => rebuild(regenerateDay(plan, input, day.index), undefined, `Day ${day.index + 1} regenerated with different picks`)}
          >
            Regenerate this day
          </button>
        </div>
      </header>
      <p className="sr-only" role="status">
        {announce}
      </p>
      {dayDiff.length > 0 && (
        <aside className="mg-daydiff" aria-label={`What changed on day ${day.index + 1}`}>
          <p className="mg-daydiff__hand" aria-hidden="true">
            rewritten:
          </p>
          <ul>
            {dayDiff.map((c, i) => (
              <li key={i} className={`mg-change mg-change--${c.tone}`}>
                {c.text}
              </li>
            ))}
          </ul>
          <button className="mg-textbtn mg-textbtn--small" onClick={() => setDayDiff([])}>
            Dismiss note
          </button>
        </aside>
      )}

      <div className="mg-day__grid">
        <ol className="mg-timeline">
          {day.kind === "arrival" && (
            <li className="mg-item mg-item--travel">
              <span className="mg-item__time">Arrive</span>
              <div className="mg-item__body">
                <h3>Travel day</h3>
                <p>About {plan.travelHours} h from home. Check in{plan.stay ? ` (${plan.stay.name})` : ""} and keep the evening light.</p>
              </div>
            </li>
          )}
          {day.items.map((item, idx) => {
            const isFav = !!item.activityId && input.favorites.includes(item.activityId);
            const note = input.notes[item.activityId ?? item.uid];
            const c = item.interests[0] ? interestColours[item.interests[0]] : "#9aa3b5";
            return (
              <li key={item.uid} className={`mg-item mg-item--${item.kind}`} style={{ "--c": c } as React.CSSProperties}>
                {item.transport && <p className="mg-item__transport">{item.transport}</p>}
                <span className="mg-item__time">{item.start}</span>
                <div className="mg-item__body">
                  <h3>
                    {item.title}
                    {isFav && <span className="mg-fav" aria-label="Starred">★</span>}
                  </h3>
                  <p>{item.detail}</p>
                  {item.kind === "activity" && (
                    <p className="mg-item__meta">
                      {item.hours} h · {item.cost ? `${money(item.cost)} est.` : "free"} · {item.walk} min walking
                      {item.open && ` · hours (sample): ${item.open}`}
                    </p>
                  )}
                  {note && noting !== item.uid && <p className="mg-note">“{note}”</p>}
                  {noting === item.uid && (
                    <form
                      className="mg-noteform"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setNote(item, (new FormData(e.currentTarget).get("note") as string).trim());
                        setNoting(null);
                      }}
                    >
                      <label className="sr-only" htmlFor={`note-${item.uid}`}>
                        Note for {item.title}
                      </label>
                      <textarea id={`note-${item.uid}`} name="note" defaultValue={note} rows={2} autoFocus maxLength={240} />
                      <div>
                        <button className="mg-btn mg-btn--small" type="submit">
                          Save note
                        </button>
                        <button className="mg-textbtn" type="button" onClick={() => setNoting(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                  {item.kind !== "rest" && (
                    <div className="mg-item__actions">
                      {item.kind === "activity" && (
                        <button aria-pressed={isFav} onClick={() => favorite(item)}>
                          {isFav ? "Starred" : "Star"}
                        </button>
                      )}
                      <button onClick={() => setNoting(noting === item.uid ? null : item.uid)}>{note ? "Edit note" : "Add note"}</button>
                      {item.alternatives.length > 0 && (
                        <button aria-expanded={replacing === item.uid} onClick={() => setReplacing(replacing === item.uid ? null : item.uid)}>
                          Replace
                        </button>
                      )}
                      <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={`Move ${item.title} earlier`}>
                        ↑
                      </button>
                      <button onClick={() => move(idx, 1)} disabled={idx === day.items.length - 1} aria-label={`Move ${item.title} later`}>
                        ↓
                      </button>
                      <button onClick={() => remove(item)}>Remove</button>
                    </div>
                  )}
                  {replacing === item.uid && (
                    <ul className="mg-alts" aria-label={`Alternatives to ${item.title}`}>
                      {item.alternatives
                        .map(act)
                        .filter((a): a is Activity => !!a && !plan.days.some((d) => d.items.some((i) => i.activityId === a.id)))
                        .map((a) => (
                          <li key={a.id}>
                            <button onClick={() => swap(item, a)}>
                              <strong>{a.name}</strong>
                              <span>
                                {a.cost ? `${money(a.cost * input.travelers)} est.` : "free"} · {a.hours} h · {dest.zones.find((z) => z.id === a.zone)?.name}
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
          {day.items.length === 0 && (
            <li className="mg-item mg-item--free">
              <div className="mg-item__body">
                <h3>Nothing planned</h3>
                <p>An open day. Regenerate it, or enjoy the space.</p>
              </div>
            </li>
          )}
          {day.kind === "departure" && (
            <li className="mg-item mg-item--travel">
              <span className="mg-item__time">Leave</span>
              <div className="mg-item__body">
                <h3>Head home</h3>
                <p>Leave time for check-out and about {plan.travelHours} h of travel.</p>
              </div>
            </li>
          )}
        </ol>
        <RouteMap dest={dest} day={day} />
      </div>
    </section>
  );
}

function RouteMap({ dest, day }: { dest: Destination; day: DayPlan }) {
  const stops = day.items.filter((i) => i.kind === "activity");
  const pts = stops.map((s) => dest.zones.find((z) => z.id === s.zone)!).filter(Boolean);
  return (
    <figure className="mg-map">
      <svg viewBox="0 0 100 100" role="img" aria-label={`Route for day ${day.index + 1}: ${stops.map((s) => s.title).join(", then ") || "no stops"}`}>
        <rect width="100" height="100" fill="#f8f3e8" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M0 ${14 + i * 14} C 30 ${8 + i * 14}, 60 ${22 + i * 14}, 100 ${12 + i * 14}`} fill="none" stroke="#e6dfcd" strokeWidth="0.4" />
        ))}
        <path d="M0 74 C20 66 30 82 52 76 S82 60 100 66 V100 H0Z" fill="#cfe3e8" />
        {dest.zones.map((z) => (
          <g key={z.id}>
            <circle cx={z.x} cy={z.y} r="6" fill="#fffdf8" stroke="#d9cfb9" strokeDasharray="1.5 1" />
            <text x={Math.min(88, Math.max(12, z.x))} y={z.y + 12} textAnchor="middle" fontSize="3.6" fill="#56607a">
              {z.name}
            </text>
          </g>
        ))}
        {pts.length > 1 && <polyline points={pts.map((p, i) => `${p.x + i * 1.2},${p.y + i * 1.2}`).join(" ")} fill="none" stroke="#c4483f" strokeWidth="1.1" strokeDasharray="2.4 1.8" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x + i * 1.2} cy={p.y + i * 1.2} r="3.6" fill="#1f2a44" />
            <text x={p.x + i * 1.2} y={p.y + i * 1.2 + 1.3} textAnchor="middle" fontSize="3.6" fill="#fff" fontWeight="700">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>Illustrative map, not to scale.</figcaption>
    </figure>
  );
}

function BudgetPanel({ plan, input, adapt }: { plan: Plan; input: TripInput; adapt: Props["adapt"] }) {
  const [booking, setBooking] = useState<"travel" | "stay" | null>(null);
  const [amount, setAmount] = useState("");
  const scale = Math.max(plan.total, plan.budget);
  return (
    <aside className="mg-budget" aria-labelledby="mg-budget-h">
      <h2 id="mg-budget-h">Where the money goes</h2>
      <div className="mg-stack" aria-hidden="true">
        {plan.lines
          .filter((l) => l.amount > 0)
          .map((l) => (
            <span key={l.key} style={{ width: `${(l.amount / scale) * 100}%`, background: lineColours[l.key] }} title={`${l.label}: ${money(l.amount)}`} />
          ))}
        <i className="mg-stack__budget" style={{ left: `${(plan.budget / scale) * 100}%` }} />
      </div>
      <p className="mg-fine">The line marks your budget.</p>
      <table className="mg-lines">
        <caption className="sr-only">Budget breakdown</caption>
        <tbody>
          {plan.lines.map((l: BudgetLine) => (
            <tr key={l.key}>
              <th scope="row">
                <i style={{ background: lineColours[l.key] }} aria-hidden="true" />
                {l.label}
                <span className="mg-lines__note">{l.note}</span>
                {(l.key === "travel" || l.key === "stay") && l.amount > 0 && (
                  <button
                    className="mg-textbtn mg-textbtn--small"
                    onClick={() => {
                      setBooking(booking === l.key ? null : (l.key as "travel" | "stay"));
                      setAmount(String(Math.round(l.amount)));
                    }}
                  >
                    {l.basis === "confirmed" ? "Change confirmed price" : "I've booked this"}
                  </button>
                )}
                {booking === l.key && (
                  <form
                    className="mg-book"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = Math.max(0, Math.round(+amount));
                      adapt({ confirmed: { ...input.confirmed, [l.key]: n } });
                      setBooking(null);
                    }}
                  >
                    <label>
                      What you paid
                      <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </label>
                    <button className="mg-btn mg-btn--small" type="submit">
                      Mark confirmed
                    </button>
                    {l.basis === "confirmed" && (
                      <button
                        type="button"
                        className="mg-textbtn mg-textbtn--small"
                        onClick={() => {
                          const c = { ...input.confirmed };
                          delete c[l.key as "travel" | "stay"];
                          adapt({ confirmed: c });
                          setBooking(null);
                        }}
                      >
                        Back to estimate
                      </button>
                    )}
                  </form>
                )}
              </th>
              <td>
                {money(l.amount)}
                <span className={`mg-basis mg-basis--${l.basis}`}>{basisLabel[l.basis]}</span>
              </td>
            </tr>
          ))}
          <tr className="mg-lines__total">
            <th scope="row">Estimated total</th>
            <td>{money(plan.total)}</td>
          </tr>
          <tr>
            <th scope="row">Your budget</th>
            <td>{money(plan.budget)}</td>
          </tr>
        </tbody>
      </table>
      <h3>Per day (activities)</h3>
      <ul className="mg-perday">
        {plan.days.map((d) => {
          const c = d.items.reduce((s, i) => s + i.cost, 0);
          return (
            <li key={d.index}>
              <span>Day {d.index + 1}</span>
              <span className="mg-perday__bar">
                <b style={{ width: `${Math.min(100, (c / Math.max(1, ...plan.days.map((x) => x.items.reduce((s, i) => s + i.cost, 0)))) * 100)}%` }} />
              </span>
              <span>{c ? money(c) : "free"}</span>
            </li>
          );
        })}
      </ul>
      <p className="mg-fine">
        Estimates come from Margin's sample data. “Confirmed” only means you told us what you paid — Margin doesn't book or check
        anything.
      </p>
    </aside>
  );
}

function Journal(props: Props & { dest: Destination }) {
  const { plan, input, dest, packing, saved, onToggleCheck } = props;
  const favs = plan.days.flatMap((d) => d.items).filter((i) => i.activityId && input.favorites.includes(i.activityId));
  const highlights = plan.days.flatMap((d) => d.items.filter((i) => i.kind === "activity").slice(0, 1).map((i) => ({ day: d.index, item: i })));
  const checks = saved?.checks ?? {};
  return (
    <section className="mg-journal" aria-label="Trip journal">
      <div className="mg-journal__cover">
        <p className="mg-journal__for">A trip for {input.travelers === 1 ? "one" : input.travelers}</p>
        <h2>{dest.name}</h2>
        <p>
          {months[input.month]}, {plan.effectiveDays} days, around {money(plan.total)}
        </p>
        <div className="mg-journal__palette" aria-hidden="true">
          {dest.palette.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="mg-journal__grid">
        <div className="mg-jcard">
          <h3>What you said matters</h3>
          <ul className="mg-ticket__tags">
            {input.interests.map((i) => (
              <li key={i} style={{ background: interestColours[i] }}>
                {interestLabels[i]}
              </li>
            ))}
          </ul>
          <p>
            {input.pace[0].toUpperCase() + input.pace.slice(1)} pace, up to {input.maxWalk} minutes of walking a day{input.stepFree ? ", step-free" : ""}
            {input.diet.length ? `, ${input.diet.join(" & ")} food` : ""}.
          </p>
        </div>
        <div className="mg-jcard">
          <h3>The route</h3>
          <ol className="mg-jroute">
            {highlights.map(({ day, item }) => (
              <li key={item.uid}>
                <span>Day {day + 1}</span> {item.title}
              </li>
            ))}
          </ol>
        </div>
        <div className="mg-jcard">
          <h3>Starred</h3>
          {favs.length ? (
            <ul>
              {favs.map((f) => (
                <li key={f.uid}>
                  {f.title}
                  {input.notes[f.activityId!] && <em> — “{input.notes[f.activityId!]}”</em>}
                </li>
              ))}
            </ul>
          ) : (
            <p>Star activities in the day-by-day view and they'll be collected here — and kept when the trip changes.</p>
          )}
        </div>
        <div className="mg-jcard mg-jcard--wide">
          <h3>Packing list</h3>
          {!saved && <p className="mg-fine">Save the trip to tick things off.</p>}
          <ul className="mg-checklist">
            {packing.map((p) => (
              <li key={p}>
                <label>
                  <input type="checkbox" disabled={!saved} checked={!!checks[`pack:${p}`]} onChange={() => onToggleCheck(`pack:${p}`)} />
                  {p}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="mg-jcard mg-jcard--wide">
          <h3>Before you go</h3>
          <ul className="mg-checklist">
            {prepTasks.map((p) => (
              <li key={p}>
                <label>
                  <input type="checkbox" disabled={!saved} checked={!!checks[`prep:${p}`]} onChange={() => onToggleCheck(`prep:${p}`)} />
                  {p}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
