import { useState } from "react";
import { href } from "../lib/router";
import { projects, projectById, type ProjectId } from "../content/projects";
import { owner } from "../content/owner";
import { usePortal } from "../shell/Portal";
import { cases } from "./content";
import { ProjectCover } from "../shell/ProjectCover";
import "../shell/folder.css";
import "./cases.css";

const artifacts: Record<ProjectId, () => React.ReactNode> = {
  sailor: () => <ProjectCover id="sailor" decorative />,
  lightleak: () => <ProjectCover id="lightleak" decorative />,
  ranch: () => <ProjectCover id="ranch" decorative />,
  margin: () => <ProjectCover id="margin" decorative />,
};

/** A live, scaled copy of the actual product, loaded only when asked for. */
function LiveDemo({ route, title }: { route: string; title: string }) {
  const [on, setOn] = useState(false);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const src = `${window.location.pathname}#${route}`;
  return (
    <div className="cs-live">
      <div className="cs-live__bar">
        <div className="cs-seg" role="radiogroup" aria-label="Preview size">
          {(["desktop", "phone"] as const).map((d) => (
            <button key={d} role="radio" aria-checked={device === d} onClick={() => setDevice(d)}>
              {d === "desktop" ? "Desktop" : "Phone"}
            </button>
          ))}
        </div>
        <a href={href(route)}>Open full screen</a>
      </div>
      <div className={`cs-live__frame cs-live__frame--${device}`}>
        {on ? (
          <iframe title={`${title} — live preview`} src={src} loading="lazy" />
        ) : (
          <button className="cs-live__start" onClick={() => setOn(true)}>
            Load the working prototype here
          </button>
        )}
      </div>
    </div>
  );
}

function Wire({ label, boxes }: { label: string; boxes: [number, number, number, number, string][] }) {
  return (
    <figure className="cs-wire">
      <svg viewBox="0 0 100 100" role="img" aria-label={`Wireframe: ${label}. Regions: ${boxes.map((b) => b[4]).join(", ")}`}>
        <rect width="100" height="100" fill="#fff" />
        {boxes.map(([x, y, w, h, t], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill="none" stroke="#5f5463" strokeWidth=".5" strokeDasharray="1.5 1" />
            <line x1={x} y1={y} x2={x + w} y2={y + h} stroke="#cfc8d4" strokeWidth=".3" />
            <text x={x + 1.5} y={y + 4.5} fontSize="3.2" fill="#2e2433" fontFamily="Caveat, cursive">
              {t}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export default function CaseStudy({ id }: { id: string }) {
  const p = projectById(id);
  const launch = usePortal();
  if (!p) {
    return (
      <main className="pf cs-missing">
        <p>That case study doesn't exist.</p>
        <a href={href("/archive")}>Back to the folder</a>
      </main>
    );
  }
  const c = cases[p.id];
  const i = projects.indexOf(p);
  const next = projects[(i + 1) % projects.length];

  return (
    <main className={`pf cs cs--${p.id}`}>
      <nav className="pf-nav" aria-label="Portfolio">
        <a className="pf-pill" href={href("/archive")}>
          Back to the folder
        </a>
        {projects.map((x) => (
          <a key={x.id} className="pf-pill" href={href(`/case/${x.id}`)} aria-current={x.id === p.id ? "page" : undefined}>
            {x.title}
          </a>
        ))}
      </nav>

      <header className="cs-head">
        <div className="cs-head__art" aria-hidden="true">
          {artifacts[p.id]()}
        </div>
        <div className="cs-head__text">
          <p className="cs-kicker">Case study · self-initiated concept</p>
          <h1>{p.title}</h1>
          <p className="cs-q">“{p.question}”</p>
          <p>{c.overview}</p>
          <div className="cs-head__actions">
            <button className="artifact__enter" onClick={(e) => launch({ from: e.currentTarget, to: p.route, color: p.portalColor, label: p.title })}>
              Open the concept
            </button>
            <span className="cs-skill">Shows: {p.skill.toLowerCase()}</span>
          </div>
        </div>
      </header>

      <div className="cs-board">
        <section className="cs-sheet cs-sheet--audience">
          <h2>Who it's for</h2>
          <ul>
            {c.audience.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="cs-honest">Imagined audience — no research participants were involved.</p>
        </section>
        <section className="cs-sheet cs-sheet--challenge">
          <h2>The design challenge</h2>
          <p className="cs-big">{c.challenge}</p>
        </section>
        <section className="cs-sheet cs-sheet--direction">
          <h2>Creative direction</h2>
          <p>{c.direction}</p>
        </section>

        <section className="cs-sheet cs-sheet--wide cs-mood">
          <h2>Reference board</h2>
          <ul className="cs-mood__grid">
            {c.references.map((r, k) => (
              <li key={r.label} style={{ "--sw": r.swatch, "--rot": `${(k % 2 ? 1 : -1) * (1 + k * 0.6)}deg` } as React.CSSProperties}>
                <span className="cs-mood__chip" aria-hidden="true" />
                <strong>{r.label}</strong>
                <span>{r.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="cs-sheet cs-type">
          <h2>Typography</h2>
          {c.type.map((t) => (
            <div key={t.name} className="cs-type__row">
              <p className="cs-type__sample" style={{ fontFamily: t.family }}>
                {t.sample}
              </p>
              <p className="cs-type__meta">
                {t.name} — {t.role}
              </p>
            </div>
          ))}
        </section>
        <section className="cs-sheet cs-colours">
          <h2>Colour</h2>
          <ul>
            {c.colours.map((col) => (
              <li key={col.hex}>
                <i style={{ background: col.hex }} aria-hidden="true" />
                <span>{col.name}</span>
                <code>{col.hex}</code>
              </li>
            ))}
          </ul>
        </section>

        <section className="cs-sheet cs-sheet--wide cs-journeys">
          <h2>Key journeys</h2>
          <div className="cs-journeys__grid">
            {c.journeys.map((j) => (
              <div key={j.title}>
                <h3>{j.title}</h3>
                <ol>
                  {j.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="cs-sheet cs-sheet--wide cs-wires">
          <h2>Structure sketches</h2>
          <div className="cs-wires__grid">
            {c.wireframe.map((w) => (
              <Wire key={w.label} {...w} />
            ))}
          </div>
        </section>

        <section className="cs-sheet cs-sheet--full">
          <h2>Final UI — the real thing</h2>
          <p>This is the working prototype, not a screenshot. Switch to phone width to see the responsive layout.</p>
          <LiveDemo route={p.route} title={p.title} />
          <p className="cs-responsive">{c.responsive}</p>
        </section>

        <section className="cs-sheet cs-sheet--wide cs-states">
          <h2>States worth designing</h2>
          <ul>
            {c.states.map((s) => (
              <li key={s.title}>
                <strong>{s.title}</strong>
                <span>{s.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="cs-sheet">
          <h2>Trade-offs</h2>
          <ul>
            {c.tradeoffs.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section className="cs-sheet cs-sheet--note">
          <h2>What I learned</h2>
          <ul>
            {c.learned.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section className="cs-sheet">
          <h2>What I'd do next</h2>
          <ul>
            {c.next.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="cs-foot">
        <p>
          {p.title} is a self-initiated concept by {owner.name}. The brand, content and data are fictional or illustrative; no client,
          user research or business results are implied.
        </p>
        <a className="cs-next" href={href(`/case/${next.id}`)}>
          Next case study: {next.title}
        </a>
      </footer>
    </main>
  );
}
