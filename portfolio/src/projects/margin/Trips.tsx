import { useState } from "react";
import { href } from "../../lib/router";
import { Reveal, SplitWords } from "../../lib/scroll";
import { destinationById } from "./data";
import { money, packingList } from "./engine";
import { base, prepTasks, type SavedTrip } from "./Margin";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Trips({
  trips,
  onOpen,
  onDelete,
  onRename,
  onToggle,
}: {
  trips: SavedTrip[];
  onOpen: (t: SavedTrip) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string, key: string) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!trips.length)
    return (
      <section className="mg-trips mg-trips--empty">
        <p className="mg-trips__hand" aria-hidden="true">
          this page is waiting
        </p>
        <h1>
          <SplitWords text="Your trips" />
        </h1>
        <p className="mg-lede">Nothing saved yet. Build a trip, then press “Save trip” — it stays in this browser.</p>
        <a className="mg-btn" href={href(`${base}/plan`)}>
          Plan a trip
        </a>
      </section>
    );

  return (
    <section className="mg-trips">
      <p className="mg-eyebrow">
        {trips.length} {trips.length === 1 ? "page" : "pages"} in this browser
      </p>
      <h1>
        <SplitWords text="Your trips" />
      </h1>
      <p className="mg-fine">Saved in this browser. Every figure is an estimate unless you marked it confirmed.</p>
      <ul className="mg-tripgrid">
        {trips.map((t, idx) => {
          const dest = destinationById(t.plan.destinationId)!;
          const pack = packingList(t.input, t.plan);
          const keys = [...prepTasks.map((p) => `prep:${p}`), ...pack.map((p) => `pack:${p}`)];
          const done = keys.filter((k) => t.checks[k]).length;
          const pct = Math.round((done / keys.length) * 100);
          const acts = t.plan.days.flatMap((d) => d.items).filter((i) => i.kind === "activity");
          const confirmed = t.plan.lines.filter((l) => l.basis === "confirmed").length;
          return (
            <Reveal as="li" key={t.id} delay={Math.min(idx, 5) * 80} className="mg-tripcard" style={{ "--d1": dest.palette[0], "--d2": dest.palette[1] } as React.CSSProperties}>
              <div className="mg-tripcard__band" aria-hidden="true" />
              {renaming === t.id ? (
                <input
                  className="mg-rename"
                  defaultValue={t.name}
                  autoFocus
                  aria-label="Trip name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={(e) => {
                    if (e.target.value.trim()) onRename(t.id, e.target.value.trim());
                    setRenaming(null);
                  }}
                />
              ) : (
                <h2>{t.name}</h2>
              )}
              <dl className="mg-tripcard__facts">
                <div>
                  <dt>Where</dt>
                  <dd>{dest.name}</dd>
                </div>
                <div>
                  <dt>When</dt>
                  <dd>
                    {months[t.input.month]} · {t.plan.effectiveDays} days
                  </dd>
                </div>
                <div>
                  <dt>Estimated</dt>
                  <dd>
                    {money(t.plan.total)} of {money(t.plan.budget)}
                  </dd>
                </div>
                <div>
                  <dt>Planned</dt>
                  <dd>
                    {acts.length} activities · {t.input.favorites.length} starred
                  </dd>
                </div>
              </dl>
              <p className={`mg-badge mg-badge--${confirmed ? "fits" : "est"}`}>{confirmed ? `${confirmed} cost${confirmed > 1 ? "s" : ""} confirmed` : "Estimate only — nothing booked"}</p>
              <div className="mg-progress">
                <span>Ready to go: {pct}%</span>
                <span className="mg-meter" aria-hidden="true">
                  <b style={{ width: `${pct}%`, background: "var(--d1)" }} />
                </span>
              </div>
              <button className="mg-textbtn" aria-expanded={expanded === t.id} onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                {expanded === t.id ? "Hide checklist" : "Show checklist"}
              </button>
              {expanded === t.id && (
                <ul className="mg-checklist">
                  {keys.map((k) => (
                    <li key={k}>
                      <label>
                        <input type="checkbox" checked={!!t.checks[k]} onChange={() => onToggle(t.id, k)} />
                        {k.split(":")[1]}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mg-actions">
                <button className="mg-btn mg-btn--small" onClick={() => onOpen(t)}>
                  Open & edit
                </button>
                <button className="mg-textbtn" onClick={() => setRenaming(t.id)}>
                  Rename
                </button>
                {confirming === t.id ? (
                  <span className="mg-confirm">
                    Delete this trip?{" "}
                    <button className="mg-textbtn" onClick={() => onDelete(t.id)}>
                      Yes, delete
                    </button>{" "}
                    <button className="mg-textbtn" onClick={() => setConfirming(null)}>
                      Keep it
                    </button>
                  </span>
                ) : (
                  <button className="mg-textbtn" onClick={() => setConfirming(t.id)}>
                    Delete
                  </button>
                )}
              </div>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
