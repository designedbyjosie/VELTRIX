import { useEffect, useState } from "react";
import { href } from "../lib/router";
import { owner } from "../content/owner";
import { projects, projectById, type ProjectId } from "../content/projects";
import { usePortal } from "../shell/Portal";
import { SailorArtifact, LightleakArtifact, RanchArtifact, MarginArtifact } from "../shell/Artifacts";
import { playSketch, stopSketch } from "../projects/lightleak/sketch";
import type { Track } from "../projects/lightleak/catalog";
import { deskPlaylist, evolutions, experiments, moodItems, notes, photoStudies, process, sketches, type MoodItem, type ObjectId } from "./content";

interface ViewProps {
  id: ObjectId;
  clipped: boolean;
  onConnect: (p: ProjectId) => void;
  onOpen: (id: ObjectId) => void;
  onClose: () => void;
}

export function View(props: ViewProps) {
  switch (props.id) {
    case "letter":
      return <Letter clipped={props.clipped} onOpen={props.onOpen} />;
    case "laptop":
      return <Laptop onConnect={props.onConnect} />;
    case "sketchbook":
      return <Sketchbook onConnect={props.onConnect} />;
    case "moodboard":
      return <Moodboard onConnect={props.onConnect} />;
    case "pinboard":
      return <Pinboard onConnect={props.onConnect} />;
    case "headphones":
      return <Headphones onConnect={props.onConnect} />;
    case "notes":
      return <NotesPanel onConnect={props.onConnect} />;
    case "photos":
      return <Photos />;
    case "envelope":
      return <Envelope />;
    default:
      return null;
  }
}

function ProjectLink({ id, onConnect }: { id: ProjectId; onConnect: (p: ProjectId) => void }) {
  const p = projectById(id)!;
  return (
    <span className="desk-connect">
      <button className="linkish" onClick={() => onConnect(id)}>
        Pin the connection to {p.title}
      </button>{" "}
      · <a href={href(p.route)}>open it</a>
    </span>
  );
}

/* ---------------- letter: unfolds ---------------- */
function Letter({ clipped, onOpen }: { clipped: boolean; onOpen: (id: ObjectId) => void }) {
  return (
    <article className="desk-letter">
      <div className="desk-letter__fold desk-letter__fold--top" aria-hidden="true" />
      <h2 id="desk-view-title" className="sr-only">
        A letter from {owner.name}
      </h2>
      {owner.letter.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p className="desk-letter__sign">{owner.signature}</p>
      {clipped && <p className="desk-letter__ps">P.S. You found the paperclip. I like people who poke at things.</p>}
      <div className="desk-letter__actions">
        <a href={`mailto:${owner.email}`} className="artifact__enter">
          Write back
        </a>
        <button className="linkish" onClick={() => onOpen("laptop")}>
          See how I work
        </button>
      </div>
    </article>
  );
}

/* ---------------- laptop: a screen that becomes a workstation ---------------- */
function Laptop({ onConnect }: { onConnect: (p: ProjectId) => void }) {
  const [tab, setTab] = useState<ProjectId | "process">("process");
  const [stage, setStage] = useState(50);
  return (
    <div className="desk-screen">
      <div className="desk-screen__bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>process.fig — work in progress</span>
      </div>
      <h2 id="desk-view-title">How an idea becomes an interface</h2>
      <div className="desk-tabs" role="tablist" aria-label="Choose a project">
        {(["process", ...projects.map((p) => p.id)] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === "process" ? "My process" : projectById(t)!.title}
          </button>
        ))}
      </div>
      {tab === "process" ? (
        <ol className="desk-process">
          {process.map((s) => (
            <li key={s.step}>
              <strong>{s.step}</strong>
              <span>{s.body}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="desk-evo">
          <p className="desk-evo__idea">{evolutions[tab].idea}</p>
          <div className="desk-compare" style={{ "--split": `${stage}%` } as React.CSSProperties}>
            <div className="desk-compare__before" aria-hidden={stage < 10}>
              <span className="desk-compare__tag">First sketch</span>
              <svg viewBox="0 0 200 110">
                <rect x="10" y="10" width="180" height="90" fill="none" stroke="#5f5463" strokeDasharray="4 3" />
                <rect x="20" y="20" width="70" height="40" fill="none" stroke="#5f5463" />
                <rect x="100" y="20" width="80" height="16" fill="none" stroke="#5f5463" />
                <rect x="100" y="42" width="56" height="8" fill="none" stroke="#5f5463" />
                <rect x="20" y="70" width="160" height="20" fill="none" stroke="#5f5463" />
              </svg>
              <p>{evolutions[tab].sketch}</p>
            </div>
            <div className="desk-compare__after">
              <span className="desk-compare__tag">Final</span>
              <p>{evolutions[tab].final}</p>
              <div className="desk-compare__art" aria-hidden="true">
                {tab === "sailor" && <SailorArtifact />}
                {tab === "lightleak" && <LightleakArtifact />}
                {tab === "ranch" && <RanchArtifact />}
                {tab === "margin" && <MarginArtifact />}
              </div>
            </div>
          </div>
          <label className="desk-compare__slider">
            Sketch
            <input type="range" min={0} max={100} value={stage} onChange={(e) => setStage(+e.target.value)} aria-label="Slide between the first sketch and the final design" />
            Final
          </label>
          <p className="desk-evo__decision">
            <strong>The decision that mattered:</strong> {evolutions[tab].decision}
          </p>
          <p>
            <a href={href(`/case/${tab}`)}>Read the full case study</a> · <ProjectLink id={tab} onConnect={onConnect} />
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- sketchbook: flip pages ---------------- */
function Sketchbook({ onConnect }: { onConnect: (p: ProjectId) => void }) {
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const s = sketches[page];
  const go = (d: 1 | -1) => {
    setDir(d);
    setPage((p) => (p + d + sketches.length) % sketches.length);
  };
  return (
    <div className="desk-sketch">
      <h2 id="desk-view-title" className="sr-only">
        Sketchbook
      </h2>
      <div className="desk-sketch__spread" key={page} data-dir={dir}>
        <div className="desk-sketch__page desk-sketch__page--art" aria-hidden="true">
          <SketchArt kind={s.kind} seed={page} />
        </div>
        <div className="desk-sketch__page">
          <p className="desk-sketch__kind">
            {s.kind} {s.finished ? "" : "· unfinished"}
          </p>
          <h3>{s.title}</h3>
          <p className="desk-sketch__note">{s.note}</p>
          {s.related && <ProjectLink id={s.related} onConnect={onConnect} />}
          <p className="desk-fine">Illustrative sketch made for this portfolio — replace with scans of your own pages.</p>
        </div>
      </div>
      <div className="desk-sketch__nav">
        <button className="linkish" onClick={() => go(-1)}>
          Previous page
        </button>
        <span aria-live="polite">
          Page {page + 1} of {sketches.length}
        </span>
        <button className="linkish" onClick={() => go(1)}>
          Next page
        </button>
      </div>
    </div>
  );
}

function SketchArt({ kind, seed }: { kind: string; seed: number }) {
  const ink = "#4a3f55";
  return (
    <svg viewBox="0 0 200 240" className="desk-sketch__svg">
      <g fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round">
        {kind === "idea" && (
          <>
            <path d="M70 60 q30 -40 60 0 q10 30 -10 50 v20 h-40 v-20 q-20 -20 -10 -50z" />
            <path d="M88 150 h24 M90 158 h20" />
            <path d="M40 40 l14 10 M160 40 l-14 10 M30 90 h16 M154 90 h16" strokeDasharray="3 4" />
            <text x="40" y="210" fontFamily="Caveat" fontSize="20" fill={ink} stroke="none">
              {seed % 2 ? "the product changes the page" : "what if…"}
            </text>
          </>
        )}
        {kind === "layout" && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <rect x={20 + (i % 2) * 90} y={30 + Math.floor(i / 2) * 90} width="70" height="60" />
                <path d={`M${24 + (i % 2) * 90} ${100 + Math.floor(i / 2) * 90} h50`} />
              </g>
            ))}
            <ellipse cx="146" cy="60" rx="44" ry="38" stroke="#d7362b" strokeWidth="2.4" />
          </>
        )}
        {kind === "type" && (
          <>
            <text x="20" y="70" fontFamily="'Alfa Slab One', serif" fontSize="40" fill={ink} stroke="none">
              Aa
            </text>
            <text x="110" y="70" fontFamily="Georgia" fontSize="40" fill="#bbb" stroke="none">
              Aa
            </text>
            <path d="M110 45 l50 30 M160 45 l-50 30" stroke="#d7362b" />
            <text x="20" y="150" fontFamily="'Alfa Slab One', serif" fontSize="34" fill="#efe2c8" stroke={ink} strokeWidth="1">
              WELLS
            </text>
            <path d="M20 170 h150" strokeDasharray="2 4" />
          </>
        )}
        {kind === "colour" && (
          <>
            {["#f3c3b6", "#f8dc6c", "#4a2f62", "#b9d6c6", "#f9c9a6"].map((c, i) => (
              <rect key={c} x={20 + i * 34} y="40" width="28" height="80" fill={c} stroke={ink} />
            ))}
            <path d="M20 150 h160" />
            <text x="20" y="180" fontFamily="Caveat" fontSize="20" fill={ink} stroke="none">
              one ink? no.
            </text>
          </>
        )}
        {kind === "interaction" && (
          <>
            <path d="M20 120 h160" strokeWidth="2.4" stroke="#e8a33d" />
            {[30, 70, 110, 150].map((x, i) => (
              <rect key={x} x={x} y={i % 2 ? 80 : 130} width="26" height={i % 2 ? 30 : 40} />
            ))}
            <path d="M120 60 v40 m-8 -10 l8 10 l8 -10" />
            <text x="20" y="210" fontFamily="Caveat" fontSize="20" fill={ink} stroke="none">
              budget as a horizon?
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

/* ---------------- moodboard: filter and annotate ---------------- */
function Moodboard({ onConnect }: { onConnect: (p: ProjectId) => void }) {
  const cats = Array.from(new Set(moodItems.map((m) => m.category)));
  const [cat, setCat] = useState<string | null>(null);
  const [sel, setSel] = useState<MoodItem | null>(null);
  const list = moodItems.filter((m) => !cat || m.category === cat);
  return (
    <div className="desk-mood">
      <h2 id="desk-view-title">What I look at</h2>
      <div className="desk-chips" role="group" aria-label="Filter references">
        <button aria-pressed={!cat} onClick={() => setCat(null)}>
          All
        </button>
        {cats.map((c) => (
          <button key={c} aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="desk-mood__grid">
        <ul>
          {list.map((m, i) => (
            <li key={m.id} style={{ "--rot": `${((i * 7) % 5) - 2}deg` } as React.CSSProperties}>
              <button aria-pressed={sel?.id === m.id} onClick={() => setSel(m)}>
                <span className="desk-mood__art" style={{ background: m.art }} aria-hidden="true" />
                <span>{m.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <aside className="desk-mood__note" aria-live="polite">
          {sel ? (
            <>
              <p className="desk-fine">{sel.category}</p>
              <h3>{sel.title}</h3>
              <p>{sel.note}</p>
              {sel.related && <ProjectLink id={sel.related} onConnect={onConnect} />}
            </>
          ) : (
            <p>Pick a reference to read why it's on the board.</p>
          )}
          <p className="desk-fine">Swatches are original stand-ins describing kinds of references. Add your own, with credit.</p>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- pinboard: how the four worlds connect ---------------- */
function Pinboard({ onConnect }: { onConnect: (p: ProjectId) => void }) {
  const [sel, setSel] = useState<ProjectId>("sailor");
  const launch = usePortal();
  const p = projectById(sel)!;
  const arts: Record<ProjectId, React.ReactNode> = { sailor: <SailorArtifact />, lightleak: <LightleakArtifact />, ranch: <RanchArtifact />, margin: <MarginArtifact /> };
  return (
    <div className="desk-board">
      <h2 id="desk-view-title">Four worlds, one person</h2>
      <div className="desk-board__grid">
        <ul className="desk-board__cork">
          {projects.map((x) => (
            <li key={x.id}>
              <button aria-pressed={sel === x.id} onClick={() => (setSel(x.id), onConnect(x.id))}>
                <span className="desk-board__mini" aria-hidden="true">
                  {arts[x.id]}
                </span>
                <span>{x.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="desk-board__card" aria-live="polite">
          <h3>{p.title}</h3>
          <dl>
            <dt>The challenge</dt>
            <dd>{p.question}</dd>
            <dt>The visual direction</dt>
            <dd>{p.summary}</dd>
            <dt>Most interesting interaction</dt>
            <dd>{p.signature}</dd>
            <dt>The skill I wanted to explore</dt>
            <dd>{p.skill}</dd>
          </dl>
          <button className="artifact__enter" onClick={(e) => launch({ from: e.currentTarget, to: p.route, color: p.portalColor, label: p.title })}>
            Open {p.title}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- headphones: a small music corner ---------------- */
function Headphones({ onConnect }: { onConnect: (p: ProjectId) => void }) {
  const [playing, setPlaying] = useState<number | null>(null);
  useEffect(() => () => stopSketch(), []);
  const toggle = (i: number) => {
    if (playing === i) {
      stopSketch();
      setPlaying(null);
      return;
    }
    const s = deskPlaylist[i];
    const track: Track = { id: s.title, title: s.title, artist: s.artist, year: 2000, genre: "indie", moods: [s.mood], energy: s.mood === "cinematic" ? 0.6 : 0.3, popularity: 0.5, vocal: true, explicit: false };
    setPlaying(playSketch(track, () => setPlaying((p) => (p === i ? null : p))) ? i : null);
  };
  return (
    <div className="desk-music">
      <h2 id="desk-view-title">On while I work</h2>
      <p className="desk-fine">A demo selection, not real listening history. Play buttons make a short generated mood sketch — not the songs themselves.</p>
      <ol>
        {deskPlaylist.map((s, i) => (
          <li key={s.title}>
            <button aria-pressed={playing === i} onClick={() => toggle(i)} aria-label={`${playing === i ? "Stop" : "Play"} mood sketch for ${s.title}`}>
              <span className={`desk-music__disc ${playing === i ? "is-spinning" : ""}`} aria-hidden="true" />
            </button>
            <span>
              <strong>{s.title}</strong> — {s.artist}
              <em>{s.when}</em>
            </span>
          </li>
        ))}
      </ol>
      <p>
        Music and pictures are how I got the idea for Lightleak. <ProjectLink id="lightleak" onConnect={onConnect} />
      </p>
    </div>
  );
}

/* ---------------- sticky notes ---------------- */
export function NotesOnDesk({ onDiscover, onConnect }: { onDiscover: () => void; onConnect: (p: ProjectId) => void }) {
  const [flipped, setFlipped] = useState<number[]>([]);
  return (
    <ul className="desk-notes" aria-label="Sticky notes: things I'm learning">
      {notes.slice(0, 4).map((n, i) => {
        const on = flipped.includes(i);
        return (
          <li key={n.front} style={{ "--nr": `${[-6, 4, -2, 7][i]}deg`, "--nc": n.colour, "--nx": `${[0, 46, 8, 50][i]}%`, "--ny": `${[0, 6, 52, 58][i]}%` } as React.CSSProperties}>
            <button
              className={`desk-note ${on ? "is-flipped" : ""}`}
              aria-pressed={on}
              aria-label={on ? `${n.front}: ${n.back}` : `Sticky note: ${n.front}. Flip it`}
              onClick={() => {
                onDiscover();
                setFlipped((f) => (on ? f.filter((x) => x !== i) : [...f, i]));
                if (!on && n.related) onConnect(n.related);
              }}
            >
              <span className="desk-note__inner">
                <span className="desk-note__face">{n.front}</span>
                <span className="desk-note__face desk-note__back">{n.back}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NotesPanel({ onConnect }: { onConnect: (p: ProjectId) => void }) {
  return (
    <div className="desk-notespanel">
      <h2 id="desk-view-title">Things I'm learning</h2>
      <ul>
        {notes.map((n) => (
          <li key={n.front} style={{ background: n.colour }}>
            <strong>{n.front}</strong>
            <span>{n.back}</span>
            {n.related && <ProjectLink id={n.related} onConnect={onConnect} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- drawer: slides open in place ---------------- */
export function DrawerContents({ onClose, inline = false }: { onClose: () => void; inline?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className={`desk-drawer ${inline ? "desk-drawer--inline" : ""}`} aria-label="Inside the drawer: unfinished experiments">
      <div className="desk-drawer__head">
        <h2>Inside the drawer</h2>
        <button className="linkish" onClick={onClose}>
          Close the drawer
        </button>
      </div>
      <ul>
        {experiments.map((x, i) => (
          <li key={x.title} style={{ "--dr": `${(i % 2 ? 1 : -1) * (2 + i)}deg` } as React.CSSProperties}>
            <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="desk-drawer__status">{x.status}</span>
              <strong>{x.title}</strong>
              {open === i && (
                <span className="desk-drawer__body">
                  {x.body}
                  <em>What it taught me: {x.lesson}</em>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="desk-fine">Placeholder experiments — swap in your own half-finished ideas.</p>
    </section>
  );
}

/* ---------------- photographs: inspect colour ---------------- */
function Photos() {
  const [i, setI] = useState(0);
  const [turned, setTurned] = useState(false);
  const s = photoStudies[i];
  return (
    <div className="desk-photos">
      <h2 id="desk-view-title">Things I noticed</h2>
      <div className="desk-photos__grid">
        <figure className="desk-photos__print">
          <span className="desk-photos__img" style={{ background: `linear-gradient(160deg, ${s.palette.join(", ")})` }} role="img" aria-label={`Colour study: ${s.title}`} />
          <figcaption>{s.title}</figcaption>
        </figure>
        <div>
          <p>{s.note}</p>
          <ul className="desk-photos__palette" aria-label="Palette">
            {s.palette.map((c) => (
              <li key={c}>
                <i style={{ background: c }} />
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <div className="desk-chips" role="group" aria-label="Choose a photograph">
            {photoStudies.map((p, k) => (
              <button key={p.title} aria-pressed={k === i} onClick={() => (setI(k), setTurned(false))}>
                {p.title}
              </button>
            ))}
          </div>
          {i === photoStudies.length - 1 && (
            <button className="linkish desk-photos__turn" onClick={() => setTurned((t) => !t)}>
              {turned ? "Turn it back" : "Turn this one over"}
            </button>
          )}
          {turned && <p className="desk-photos__secret">On the back, in pencil: “the best ideas look boring for the first ten minutes.”</p>}
        </div>
      </div>
      <p className="desk-fine">Colour studies stand in for real photographs. Add your own and keep the palettes.</p>
    </div>
  );
}

/* ---------------- sealed envelope: the closing invitation ---------------- */
function Envelope() {
  const [opened, setOpened] = useState(false);
  const [form, setForm] = useState({ name: "", reason: "Internship", message: "" });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (!opened)
    return (
      <div className="desk-envelope">
        <h2 id="desk-view-title">For potential collaborators</h2>
        <button className="desk-envelope__seal" onClick={() => setOpened(true)}>
          Break the seal
        </button>
      </div>
    );
  const mailto = `mailto:${owner.email}?subject=${encodeURIComponent(`${form.reason}: hello from ${form.name || "your portfolio"}`)}&body=${encodeURIComponent(form.message)}`;
  return (
    <div className="desk-envelope desk-envelope--open">
      <h2 id="desk-view-title">Let's make something</h2>
      <p>
        I'm {owner.availability.toLowerCase()}. I'm happiest on small teams where I can learn by doing real work — and I'll bring
        energy, curiosity and a lot of prototypes.
      </p>
      {done ? (
        <p className="desk-env__done" role="status">
          Your email app should have opened with the message ready to send. Nothing was sent from this page. If it didn't open, write to{" "}
          <a href={`mailto:${owner.email}`}>{owner.email}</a>.
        </p>
      ) : (
        <form
          className="desk-env__form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return setErr("Add your name.");
            if (form.message.trim().length < 10) return setErr("Write a sentence or two so I know what it's about.");
            setErr(null);
            window.location.href = mailto;
            setDone(true);
          }}
        >
          <label>
            Your name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={err === "Add your name."} />
          </label>
          <label>
            About
            <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
              <option>Internship</option>
              <option>Apprenticeship</option>
              <option>Freelance project</option>
              <option>Just saying hi</option>
            </select>
          </label>
          <label className="desk-env__wide">
            Message
            <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </label>
          {err && (
            <p className="desk-env__err" role="alert">
              {err}
            </p>
          )}
          <button className="artifact__enter" type="submit">
            Open in my email app
          </button>
          <p className="desk-fine desk-env__wide">This opens your own email app with the message filled in. Nothing is sent from this site.</p>
        </form>
      )}
      <ul className="desk-env__links">
        <li>
          <a href={`mailto:${owner.email}`}>{owner.email}</a>
        </li>
        {owner.socials.map((s) => (
          <li key={s.label}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
