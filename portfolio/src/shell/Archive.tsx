import { useLayoutEffect, useRef, useState } from "react";
import { href, navigate } from "../lib/router";
import { prefersReducedMotion, wait } from "../lib/motion";
import { owner } from "../content/owner";
import { projects, disciplineLabels, type Discipline, type ProjectMeta } from "../content/projects";
import { usePortal } from "./Portal";
import { visited, clearVisits } from "./visits";
import { ProjectCover } from "./ProjectCover";
import { asset } from "../lib/asset";
import { Reveal, SplitWords } from "../lib/scroll";
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

  const [opening, setOpening] = useState<string | null>(null);
  const enter = async (p: ProjectMeta, el: HTMLElement) => {
    if (opening) return;
    if (!prefersReducedMotion()) {
      // The folder's front flap drops open before the portal takes over.
      setOpening(p.id);
      await wait(420);
    }
    launch({ from: el, to: p.route, color: p.portalColor, label: p.title });
    setTimeout(() => setOpening(null), 1600);
  };

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

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });

  return (
    <main className={`pf pf-archive ${leaving ? "is-leaving" : ""}`} onPointerMove={onPointerMove}>
      <nav className="pf-nav" aria-label="Portfolio">
        <button className="pf-nav__brand" onClick={close} aria-label="Close the folder and return to the cover">
          <span className="pf-nav__mono" aria-hidden="true">
            {owner.name
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </span>
          <span className="pf-nav__name">{owner.name}</span>
        </button>
        <div className="pf-nav__links">
          <a className="pf-pill pf-pill--wide-only" href="#work" onClick={(e) => (e.preventDefault(), scrollTo("work"))}>
            Work
          </a>
          <a className="pf-pill" href={href("/desk")}>
            The desk
          </a>
          <button className="pf-pill" onClick={() => setQuickRead(true)}>
            <span className="pf-wide-only">60-second version</span>
            <span className="pf-narrow-only">60 sec</span>
          </button>
          <a className="pf-pill pf-pill--solid" href="#contact" onClick={(e) => (e.preventDefault(), scrollTo("contact"))}>
            Contact
          </a>
        </div>
      </nav>

      <div className="archive-board" ref={boardRef}>
        <header className="archive-head">
          <p className="archive-head__eyebrow">
            <span>Portfolio</span>
            <span>Vol. 01</span>
            <span>Four self-initiated concepts</span>
          </p>
          <h1 className="archive-head__title">
            <SplitWords text="Four worlds," />
            <br />
            <SplitWords text="one designer." className="archive-head__italic" delay={220} />
          </h1>
          <div className="archive-head__intro">
            <Reveal as="p" className="archive-head__name" delay={300}>
              {owner.name}, {owner.age} — {owner.role.toLowerCase()}
            </Reveal>
            <Reveal as="p" delay={380}>
              {owner.shortBio}
            </Reveal>
            <Reveal as="p" className="archive-head__avail" delay={460}>
              <span className="archive-head__dot" aria-hidden="true" />
              {owner.availability}.
            </Reveal>
          </div>
          <IndexTabs filter={filter} onChoose={choose} />
        </header>

        <section className="archive-grid" id="work" aria-label="Concept projects" data-filter={filter ?? "all"}>
          {order.map((p, i) => {
            const lit = !filter || p.disciplines.includes(filter);
            const slug = p.route.split("/").pop()!;
            const n = projects.indexOf(p) + 1;
            return (
              <Reveal
                as="article"
                key={p.id}
                delay={i * 90}
                className={`pfolder pfolder--${p.id} ${lit ? "is-lit" : "is-dim"} ${opening === p.id ? "is-opening" : ""}`}
                data-artifact={p.id}
              >
                <button className="pfolder__object" onClick={(e) => enter(p, e.currentTarget)} aria-label={`Open ${p.title}, ${p.kind}`}>
                  <span className="pfolder__back" aria-hidden="true">
                    <span className="pfolder__tab">
                      <span>{String(n).padStart(2, "0")}</span>
                      {disciplineLabels[p.disciplines[0]]}
                    </span>
                  </span>
                  <span className="pfolder__paper" aria-hidden="true" />
                  <span className="pfolder__photo">
                    <ProjectCover id={p.id} decorative eager={i < 2} />
                  </span>
                  <span className="pfolder__front" aria-hidden="true">
                    <span className="pfolder__num">{String(n).padStart(2, "0")}</span>
                    <span className="pfolder__title">{p.title}</span>
                    <span className="pfolder__kind">{p.kind}</span>
                    <span className="pfolder__open">
                      Open the concept <i>→</i>
                    </span>
                  </span>
                </button>
                <div className="pfolder__caption">
                  <h2>{p.title}</h2>
                  <p className="pfolder__q">“{p.question}”</p>
                  <div className="pfolder__actions">
                    <button className="pf-btn" onClick={(e) => enter(p, e.currentTarget.closest("article")!.querySelector(".pfolder__object") as HTMLElement)}>
                      Open the concept
                    </button>
                    <a className="pf-link" href={href(`/case/${p.id}`)}>
                      Case study
                    </a>
                    {seen.includes(slug) && <span className="pfolder__stamp">Visited</span>}
                  </div>
                </div>
                <Sticky front={notes[p.id].front} back={notes[p.id].back} />
              </Reveal>
            );
          })}

          <DeskPocket />
        </section>

        <aside className="archive-side">
          <Reveal className="archive-side__card">
            <LibraryCard seen={seen} onReset={() => (clearVisits(), setSeen([]))} />
          </Reveal>
          <Reveal className="archive-side__card archive-tools" delay={100}>
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
          </Reveal>
        </aside>

        <footer className="archive-contact" id="contact">
          <p className="archive-contact__eyebrow">Contact</p>
          <h2 className="archive-contact__title">
            <SplitWords text="Let's make" />
            <br />
            <SplitWords text="something." className="archive-head__italic" delay={160} />
          </h2>
          <div className="archive-contact__body">
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
          </div>
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

/** The way in to the Creator's Desk: a wide photograph tucked into the back pocket of the folder. */
function DeskPocket() {
  const launch = usePortal();
  return (
    <Reveal className="desk-pocket" data-artifact="desk">
      <button
        className="desk-pocket__photo"
        onClick={(e) => launch({ from: e.currentTarget, to: "/desk", color: "#2a2326", label: "The Creator's Desk" })}
        aria-label="Step into the Creator's Desk: who made all this"
      >
        <img src={asset("img/covers/desk.webp")} alt="" loading="lazy" decoding="async" />
        <span className="desk-pocket__text">
          <span className="desk-pocket__eyebrow">05 — About</span>
          <span className="desk-pocket__title">
            The Creator's <em>Desk</em>
          </span>
          <span className="desk-pocket__sub">Who made all this, and how — the letter, the sketchbook and the process.</span>
          <span className="desk-pocket__go">
            Step in <i>→</i>
          </span>
        </span>
      </button>
    </Reveal>
  );
}
