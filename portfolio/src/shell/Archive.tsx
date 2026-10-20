import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { href, navigate } from "../lib/router";
import { prefersReducedMotion, wait } from "../lib/motion";
import { owner } from "../content/owner";
import { projects, disciplineLabels, type Discipline, type ProjectMeta } from "../content/projects";
import { usePortal } from "./Portal";
import { visited, clearVisits } from "./visits";
import { SailorArtifact, LightleakArtifact, RanchArtifact, MarginArtifact } from "./Artifacts";
import { QuickRead } from "./QuickRead";
import { Sticky } from "./Sticky";

const notes: Record<string, { front: string; back: string }> = {
  sailor: {
    front: "why six colours?",
    back: "Each flavour owns a full palette, not just a label colour — so the storefront can change its weather without the shopping controls ever moving.",
  },
  lightleak: {
    front: "honest about AI?",
    back: "Yes. The app reads colour and light locally and calls the result an interpretation you can edit. Nothing is uploaded; no model is pretending to know your feelings.",
  },
  ranch: {
    front: "no 3D? still works",
    back: "If WebGL isn't available or you prefer reduced motion, the ranch swaps to a layered illustrated landscape with the same places to explore.",
  },
  margin: {
    front: "the hard one",
    back: "Budget changes don't just show a warning: the planner swaps stays and activities, explains each change, and says plainly when a trip doesn't fit.",
  },
};

const artifacts: Record<string, () => ReactNode> = {
  sailor: () => <SailorArtifact />,
  lightleak: () => <LightleakArtifact />,
  ranch: () => <RanchArtifact />,
  margin: () => <MarginArtifact />,
};

interface Props {
  entranceFrom: DOMRect | null;
  onClose: () => void;
}

export function Archive({ entranceFrom, onClose }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Discipline | null>(null);
  const [quickRead, setQuickRead] = useState(false);
  const [seen, setSeen] = useState<string[]>(visited);
  const [leaving, setLeaving] = useState(false);
  const launch = usePortal();
  const positions = useRef(new Map<string, DOMRect>());

  // The inner sheet grows out of the folder into the full archive.
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || !entranceFrom || prefersReducedMotion()) return;
    const to = board.getBoundingClientRect();
    const sx = entranceFrom.width / to.width;
    const sy = entranceFrom.height / Math.min(to.height, window.innerHeight);
    board.style.transformOrigin = "0 0";
    board.style.transform = `translate(${entranceFrom.left - to.left}px, ${entranceFrom.top - to.top}px) scale(${sx}, ${sy})`;
    board.style.opacity = "0.6";
    board.getBoundingClientRect();
    requestAnimationFrame(() => {
      board.style.transition = "transform .9s var(--ease-paper), opacity .5s ease";
      board.style.transform = "";
      board.style.opacity = "";
      board.classList.add("is-arriving");
    });
    const t = setTimeout(() => {
      board.style.transition = "";
      board.classList.remove("is-arriving");
    }, 1300);
    return () => clearTimeout(t);
  }, [entranceFrom]);

  // FLIP: when the index changes the composition, artifacts glide to their new places.
  const order = [...projects].sort((a, b) => {
    if (!filter) return 0;
    return Number(b.disciplines.includes(filter)) - Number(a.disciplines.includes(filter));
  });
  const captureFirst = () => {
    positions.current.clear();
    boardRef.current?.querySelectorAll<HTMLElement>("[data-artifact]").forEach((el) => {
      positions.current.set(el.dataset.artifact!, el.getBoundingClientRect());
    });
  };
  useLayoutEffect(() => {
    if (prefersReducedMotion() || positions.current.size === 0) return;
    boardRef.current?.querySelectorAll<HTMLElement>("[data-artifact]").forEach((el) => {
      const first = positions.current.get(el.dataset.artifact!);
      if (!first) return;
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (!dx && !dy) return;
      el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], {
        duration: 650,
        easing: "cubic-bezier(.22,.8,.2,1)",
      });
    });
    positions.current.clear();
  }, [filter]);

  const choose = (d: Discipline | null) => {
    captureFirst();
    setFilter((cur) => (cur === d ? null : d));
  };

  const enter = (p: ProjectMeta, el: HTMLElement) =>
    launch({ from: el, to: p.route, color: p.portalColor, label: p.title });

  const close = async () => {
    if (prefersReducedMotion()) return onClose();
    setLeaving(true);
    await wait(520);
    onClose();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const el = boardRef.current;
    if (!el) return;
    el.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
    el.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
  };

  return (
    <main className={`pf pf-archive ${leaving ? "is-leaving" : ""}`} onPointerMove={onPointerMove}>
      <nav className="pf-nav" aria-label="Portfolio">
        <button className="pf-pill" onClick={close}>
          Close folder
        </button>
        <a className="pf-pill" href="#work" onClick={(e) => (e.preventDefault(), document.getElementById("work")?.scrollIntoView({ behavior: "smooth" }))}>
          Work
        </a>
        <a className="pf-pill" href={href("/desk")}>
          The desk
        </a>
        <button className="pf-pill" onClick={() => setQuickRead(true)}>
          60-second version
        </button>
        <a className="pf-pill" href="#contact" onClick={(e) => (e.preventDefault(), document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }))}>
          Contact
        </a>
      </nav>

      <div className="archive-board" ref={boardRef}>
        <div className="archive-board__tab" aria-hidden="true" />

        <header className="archive-head">
          <h1 className="archive-head__title">
            <span className="archive-head__script">Four</span>
            <span className="archive-head__pixel">worlds</span>
          </h1>
          <div className="archive-head__intro">
            <p className="archive-head__name">
              {owner.name}, {owner.age} — {owner.role.toLowerCase()}
            </p>
            <p>{owner.shortBio}</p>
            <p className="archive-head__avail">{owner.availability}.</p>
          </div>
          <IndexTabs filter={filter} onChoose={choose} />
        </header>

        <section className="archive-grid" id="work" aria-label="Concept projects" data-filter={filter ?? "all"}>
          {order.map((p) => {
            const lit = !filter || p.disciplines.includes(filter);
            return (
              <article key={p.id} className={`artifact artifact--${p.id} ${lit ? "is-lit" : "is-dim"}`} data-artifact={p.id}>
                <button className="artifact__object" onClick={(e) => enter(p, e.currentTarget)} aria-label={`Enter ${p.title}, ${p.kind}`}>
                  {artifacts[p.id]()}
                </button>
                <div className="artifact__caption">
                  <h2>{p.title}</h2>
                  <p className="artifact__kind">{p.kind}</p>
                  <p className="artifact__q">“{p.question}”</p>
                  <div className="artifact__actions">
                    <button className="artifact__enter" onClick={(e) => enter(p, e.currentTarget.closest("article")!.querySelector(".artifact__object") as HTMLElement)}>
                      Open the concept
                    </button>
                    <a href={href(`/case/${p.id}`)}>Case study</a>
                  </div>
                  {seen.includes(p.route.split("/").pop()!) && <span className="artifact__stamp">visited</span>}
                </div>
                <Sticky front={notes[p.id].front} back={notes[p.id].back} />
              </article>
            );
          })}

          <DeskPocket />
        </section>

        <aside className="archive-side">
          <LibraryCard seen={seen} onReset={() => (clearVisits(), setSeen([]))} />
          <div className="archive-tools">
            <h2>Tools I actually use</h2>
            <ul>
              {owner.tools.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <h2>Learning next</h2>
            <ul>
              {owner.learning.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </aside>

        <footer className="archive-contact" id="contact">
          <p className="archive-contact__script">Let's make something</p>
          <p>
            I'm looking for a first place to learn — an internship, an apprenticeship or a small project with a team that
            will push me. The quickest way to reach me:
          </p>
          <a className="archive-contact__mail" href={`mailto:${owner.email}`}>
            {owner.email}
          </a>
          <ul className="archive-contact__social">
            {owner.socials.map((s) => (
              <li key={s.label}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="archive-contact__honest">
            All four projects are self-initiated concepts. The brands, places and products are fictional; no clients,
            metrics or testimonials are implied.
          </p>
        </footer>
      </div>

      {quickRead && <QuickRead onClose={() => setQuickRead(false)} onOpen={(p) => navigate(p)} />}
    </main>
  );
}

function IndexTabs({ filter, onChoose }: { filter: Discipline | null; onChoose: (d: Discipline | null) => void }) {
  const keys = Object.keys(disciplineLabels) as Discipline[];
  return (
    <div className="index-tabs" role="group" aria-label="Rearrange the archive by discipline">
      <span className="index-tabs__hint">sort the folder by what you're hiring for</span>
      {keys.map((k) => (
        <button key={k} className={`index-tab index-tab--${k}`} aria-pressed={filter === k} onClick={() => onChoose(k)}>
          {disciplineLabels[k]}
        </button>
      ))}
      {filter && (
        <button className="index-tab index-tab--clear" onClick={() => onChoose(null)}>
          Show everything
        </button>
      )}
    </div>
  );
}

function LibraryCard({ seen, onReset }: { seen: string[]; onReset: () => void }) {
  return (
    <div className="library-card">
      <h2>Borrower's card</h2>
      <p className="library-card__sub">Worlds you've opened — kept only in this browser.</p>
      <table>
        <tbody>
          {projects.map((p) => {
            const slug = p.route.split("/").pop()!;
            return (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{seen.includes(slug) ? <span className="library-card__stamp">opened</span> : <span className="library-card__blank">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {seen.length > 0 && (
        <button className="library-card__reset" onClick={onReset}>
          Clear the card
        </button>
      )}
    </div>
  );
}

/** A little polaroid of the desk tucked into the folder's pocket — the way in to the Creator's Desk. */
function DeskPocket() {
  const launch = usePortal();
  return (
    <div className="desk-pocket" data-artifact="desk">
      <button
        className="desk-pocket__photo"
        onClick={(e) => launch({ from: e.currentTarget, to: "/desk", color: "#c9b18a", label: "The Creator's Desk" })}
        aria-label="Step into the Creator's Desk: who made all this"
      >
        <span className="desk-pocket__scene" aria-hidden="true">
          <i className="mini-laptop" />
          <i className="mini-book" />
          <i className="mini-note" />
          <i className="mini-mug" />
          <i className="mini-phones" />
        </span>
        <span className="desk-pocket__caption">the desk where it happens</span>
      </button>
      <span className="desk-pocket__lip" aria-hidden="true" />
      <p className="desk-pocket__note">who made all this?</p>
    </div>
  );
}
