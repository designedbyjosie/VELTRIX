import { useEffect, useMemo, useState } from "react";
import { activities, stays } from "./data";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Deterministic "availability" so the demo behaves consistently. Nothing is booked. */
export function sampleAvailability(stayId: string, date: string) {
  const d = new Date(date + "T12:00:00");
  const seed = (d.getUTCDate() * 7 + d.getUTCMonth() * 13 + stayId.length * 5) % 10;
  return seed < 2 ? 0 : seed < 5 ? 1 : 3;
}

export function Visit({ preset }: { preset: string | null }) {
  const today = new Date();
  const [arrive, setArrive] = useState(iso(new Date(today.getTime() + 21 * 864e5)));
  const [nights, setNights] = useState(3);
  const [guests, setGuests] = useState(2);
  const [stay, setStay] = useState("room");
  const [chosen, setChosen] = useState<string[]>(["trail"]);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (preset === "stay") setStay("cabin");
    if (preset === "ride") setChosen((c) => (c.includes("sunset") ? c : [...c, "sunset"]));
    if (preset === "evening") setChosen((c) => (c.includes("stars") ? c : [...c, "stars", "cookout"]));
    setHeld(false);
  }, [preset]);

  const s = stays.find((x) => x.id === stay)!;
  const units = Math.ceil(guests / s.sleeps);
  const nightsList = useMemo(
    () =>
      Array.from({ length: nights }, (_, i) => {
        const d = iso(new Date(new Date(arrive + "T12:00:00").getTime() + i * 864e5));
        return { date: d, left: sampleAvailability(stay, d) };
      }),
    [arrive, nights, stay],
  );
  const blocked = nightsList.filter((n) => n.left < units);
  const lodging = s.nightly * nights * units;
  const extras = chosen.reduce((sum, id) => sum + (activities.find((a) => a.id === id)?.price ?? 0) * guests, 0);
  const tooSoon = new Date(arrive) < new Date(iso(today));

  return (
    <section className="cw-section cw-visit" id="cw-visit">
      <h2 className="cw-h">Plan a visit</h2>
      <p className="cw-lede">A working demo with sample availability. Nothing here makes a real reservation.</p>
      <div className="cw-visit__grid">
        <form className="cw-form" onSubmit={(e) => (e.preventDefault(), !blocked.length && !tooSoon && setHeld(true))}>
          <label>
            Arriving
            <input type="date" value={arrive} min={iso(today)} onChange={(e) => (setArrive(e.target.value), setHeld(false))} required />
          </label>
          <label>
            Nights
            <input type="number" min={1} max={14} value={nights} onChange={(e) => (setNights(Math.max(1, Math.min(14, +e.target.value || 1))), setHeld(false))} />
          </label>
          <label>
            Guests
            <input type="number" min={1} max={16} value={guests} onChange={(e) => (setGuests(Math.max(1, Math.min(16, +e.target.value || 1))), setHeld(false))} />
          </label>
          <fieldset>
            <legend>Where to sleep</legend>
            {stays.map((x) => (
              <label key={x.id} className="cw-radio">
                <input type="radio" name="stay" checked={stay === x.id} onChange={() => (setStay(x.id), setHeld(false))} />
                {x.name} <span>sleeps {x.sleeps} · ${x.nightly}/night</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Activities</legend>
            {activities.map((a) => (
              <label key={a.id} className="cw-check">
                <input type="checkbox" checked={chosen.includes(a.id)} onChange={() => setChosen((c) => (c.includes(a.id) ? c.filter((x) => x !== a.id) : [...c, a.id]))} />
                {a.name} <span>{a.price ? `$${a.price}` : "included"}</span>
              </label>
            ))}
          </fieldset>
          <button className="cw-btn" type="submit" disabled={blocked.length > 0 || tooSoon}>
            Hold these dates (demo)
          </button>
        </form>

        <aside className="cw-ledger" aria-live="polite">
          <h3>Your stay</h3>
          <ul className="cw-nights">
            {nightsList.map((n) => (
              <li key={n.date} className={n.left < units ? "is-full" : ""}>
                <span>{new Date(n.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                <span>{n.left < units ? "Full" : `${n.left} left`}</span>
              </li>
            ))}
          </ul>
          {blocked.length > 0 && (
            <p className="cw-warn">
              {s.name} is full on {blocked.length} of your nights. Try {stays.filter((x) => x.id !== stay).map((x) => x.name).join(" or ")}, or shift your dates by a day.
            </p>
          )}
          {units > 1 && <p className="cw-fine">{guests} guests need {units} × {s.name.toLowerCase()}.</p>}
          <dl>
            <div>
              <dt>Lodging & meals</dt>
              <dd>${lodging.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Activities</dt>
              <dd>${extras.toLocaleString()}</dd>
            </div>
            <div className="cw-ledger__total">
              <dt>Estimated total</dt>
              <dd>${(lodging + extras).toLocaleString()}</dd>
            </div>
          </dl>
          {held && (
            <p className="cw-held" role="status">
              Held — in this demo only. Copper Wells is fictional, so no reservation was made and nothing was charged.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

interface Errors {
  name?: string;
  email?: string;
  message?: string;
}

export function Inquiry() {
  const [form, setForm] = useState({ name: "", email: "", message: "", topic: "Stay" });
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const validate = () => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "Add your name so we know who's writing.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter an email address like you@example.com.";
    if (form.message.trim().length < 10) e.message = "Write at least a sentence about what you'd like to know.";
    return e;
  };

  return (
    <section className="cw-section cw-inquiry">
      <h2 className="cw-h">Write to the ranch</h2>
      {sent ? (
        <div className="cw-telegram" role="status">
          <p className="cw-telegram__head">Message composed · not sent</p>
          <p>
            Thanks, {form.name.split(" ")[0]}. Copper Wells is a fictional ranch, so this form doesn't deliver anywhere. Your
            message was checked and then discarded — nothing was stored or transmitted.
          </p>
          <button className="cw-textbtn" onClick={() => (setSent(false), setForm({ name: "", email: "", message: "", topic: "Stay" }))}>
            Write another
          </button>
        </div>
      ) : (
        <form
          className="cw-form cw-form--inquiry"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const v = validate();
            setErrors(v);
            if (Object.keys(v).length === 0) setSent(true);
            else document.getElementById(`cw-${Object.keys(v)[0]}`)?.focus();
          }}
        >
          <label>
            Name
            <input id="cw-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? "cw-name-err" : undefined} />
            {errors.name && <span className="cw-err" id="cw-name-err">{errors.name}</span>}
          </label>
          <label>
            Email
            <input id="cw-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} aria-describedby={errors.email ? "cw-email-err" : undefined} />
            {errors.email && <span className="cw-err" id="cw-email-err">{errors.email}</span>}
          </label>
          <label>
            About
            <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
              <option>Stay</option>
              <option>Riding</option>
              <option>Groups & families</option>
              <option>Something else</option>
            </select>
          </label>
          <label className="cw-form__wide">
            Message
            <textarea id="cw-message" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} aria-invalid={!!errors.message} aria-describedby={errors.message ? "cw-message-err" : undefined} />
            {errors.message && <span className="cw-err" id="cw-message-err">{errors.message}</span>}
          </label>
          <p className="cw-fine cw-form__wide">Demo form: it validates your message but doesn't send it anywhere.</p>
          <button className="cw-btn" type="submit">
            Send message (demo)
          </button>
        </form>
      )}
    </section>
  );
}
