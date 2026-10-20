import { useEffect, useRef, useState } from "react";
import { href } from "../lib/router";
import { usePersistentState } from "../lib/storage";
import { prefersReducedMotion } from "../lib/motion";
import { useFocusTrap } from "../lib/useFocusTrap";
import { owner } from "../content/owner";
import { projectById, type ProjectId } from "../content/projects";
import { deskObjects, type ObjectId } from "./content";
import { ObjectArt } from "./ObjectArt";
import { DrawerContents, NotesOnDesk, View } from "./views";
import "../shell/folder.css";
import "./desk.css";

/** Where each object sits on the desktop composition (percent of the desk). */
const layout: Record<ObjectId, { x: number; y: number; w: number; r: number; z?: number }> = {
  moodboard: { x: 71, y: 3, w: 24, r: 2 },
  laptop: { x: 33, y: 8, w: 31, r: -1, z: 2 },
  sketchbook: { x: 6, y: 10, w: 21, r: 7 },
  pinboard: { x: 4, y: 54, w: 23, r: -3 },
  letter: { x: 37, y: 56, w: 15, r: -7, z: 3 },
  notes: { x: 56, y: 47, w: 13, r: 0, z: 2 },
  headphones: { x: 72, y: 58, w: 15, r: 12 },
  photos: { x: 87, y: 36, w: 10, r: -8 },
  envelope: { x: 56, y: 74, w: 12, r: 5, z: 3 },
  drawer: { x: 30, y: 89, w: 34, r: 0 },
};

export default function Desk() {
  const [open, setOpen] = useState<ObjectId | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  const [found, setFound] = usePersistentState<ObjectId[]>("desk.found", []);
  const [link, setLink] = useState<{ from: ObjectId; project: ProjectId } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clipped, setClipped] = usePersistentState("desk.clip", false);
  const [arrived, setArrived] = useState(prefersReducedMotion());
  const deskRef = useRef<HTMLDivElement>(null);
  const majors = deskObjects.filter((o) => o.major);

  useEffect(() => {
    const t = setTimeout(() => setArrived(true), 60);
    return () => clearTimeout(t);
  }, []);

  const discover = (id: ObjectId) => setFound((f) => (f.includes(id) ? f : [...f, id]));

  const openObject = (id: ObjectId, el?: HTMLElement) => {
    discover(id);
    if (id === "drawer") {
      setDrawerOpen((d) => !d);
      return;
    }
    if (id === "notes") {
      // the notes flip in place on the desk; on small screens they open as a panel
      if (window.matchMedia("(min-width: 761px)").matches) return;
    }
    setOrigin(el?.getBoundingClientRect() ?? null);
    setOpen(id);
  };

  const connect = (from: ObjectId, project: ProjectId) => setLink({ from, project });

  // the line drawn across the desk when a discovery connects to a project
  const from = link ? layout[link.from] : null;
  const pin = layout.pinboard;
  const pinSlots: Record<ProjectId, [number, number]> = { sailor: [0.25, 0.3], lightleak: [0.72, 0.28], ranch: [0.28, 0.72], margin: [0.74, 0.7] };

  return (
    <main className={`desk ${arrived ? "is-arrived" : ""}`}>
      <header className="desk-top">
        <a className="pf-pill desk-pill" href={href("/archive")}>
          Back to the folder
        </a>
        <div className="desk-top__title">
          <h1>The Creator's Desk</h1>
          <p>Everything here belongs to {owner.name}. Pick something up.</p>
        </div>
        <div className="desk-quick" aria-label="Short on time?">
          <span>Short on time?</span>
          <button onClick={(e) => openObject("letter", e.currentTarget)}>Read the letter</button>
          <button onClick={(e) => openObject("envelope", e.currentTarget)}>Get in touch</button>
        </div>
      </header>

      <div className="desk-surface" ref={deskRef}>
        <div className="desk-wood" aria-hidden="true" />
        <span className="desk-deco desk-deco--mug" aria-hidden="true" />
        <span className="desk-deco desk-deco--plant" aria-hidden="true" />
        <span className="desk-deco desk-deco--pencils" aria-hidden="true" />
        <span className="desk-deco desk-deco--lamp" aria-hidden="true" />

        {link && from && (
          <svg className="desk-link" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path
              d={`M${from.x + from.w / 2} ${from.y + 8} Q 30 30 ${pin.x + pin.w * pinSlots[link.project][0]} ${pin.y + 22 * pinSlots[link.project][1]}`}
              className="desk-link__path"
            />
          </svg>
        )}

        <ul className="desk-objects" aria-label="Objects on the desk">
          {deskObjects.map((o, i) => {
            const pos = layout[o.id];
            if (o.id === "notes") {
              return (
                <li key={o.id} className="desk-slot desk-slot--notes" style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%`, zIndex: pos.z ?? 1, transitionDelay: `${i * 50}ms` }}>
                  <NotesOnDesk onDiscover={() => discover("notes")} onConnect={(p) => connect("notes", p)} />
                </li>
              );
            }
            return (
              <li
                key={o.id}
                className={`desk-slot desk-slot--${o.id} ${found.includes(o.id) ? "is-found" : ""} ${link && o.id === "pinboard" ? "is-linked" : ""}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%`, zIndex: pos.z ?? 1, "--rot": `${pos.r}deg`, transitionDelay: `${i * 50}ms` } as React.CSSProperties}
              >
                <button
                  className="desk-object"
                  onClick={(e) => openObject(o.id, e.currentTarget)}
                  aria-label={o.label}
                  aria-expanded={o.id === "drawer" ? drawerOpen : undefined}
                >
                  <ObjectArt id={o.id} drawerOpen={drawerOpen} clipped={clipped && o.id === "letter"} linked={link?.project} />
                  <span className="desk-object__label" aria-hidden="true">
                    {o.title}
                    <em>{o.teaser}</em>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {drawerOpen && <DrawerContents onClose={() => setDrawerOpen(false)} />}

        {!clipped && <Paperclip deskRef={deskRef} onClip={() => setClipped(true)} />}
      </div>

      <section className="desk-index" aria-label="Desk index">
        <h2>Everything on the desk</h2>
        <ul>
          {deskObjects.map((o) => (
            <li key={o.id}>
              <button className={found.includes(o.id) ? "is-found" : ""} onClick={(e) => openObject(o.id === "drawer" ? "drawer" : o.id, e.currentTarget)}>
                <span className="desk-index__art" aria-hidden="true">
                  <ObjectArt id={o.id} drawerOpen={false} clipped={false} />
                </span>
                <strong>{o.title}</strong>
                <span>{o.teaser}</span>
              </button>
            </li>
          ))}
        </ul>
        {drawerOpen && (
          <div className="desk-index__drawer">
            <DrawerContents onClose={() => setDrawerOpen(false)} inline />
          </div>
        )}
      </section>

      <footer className="desk-trail" aria-label="Discovery trail">
        <ol aria-hidden="true">
          {majors.map((o) => (
            <li key={o.id} className={found.includes(o.id) ? "is-on" : ""} title={o.title} />
          ))}
        </ol>
        <p>
          {found.filter((f) => majors.some((m) => m.id === f)).length} of {majors.length} things picked up
          {link && (
            <>
              {" "}
              · last connection: <a href={href(`/case/${link.project}`)}>{projectById(link.project)?.title}</a>
            </>
          )}
        </p>
        {found.length > 0 && (
          <button className="linkish" onClick={() => (setFound([]), setClipped(false), setLink(null))}>
            Tidy the desk
          </button>
        )}
      </footer>

      {open && <Overlay id={open} origin={origin} clipped={clipped} onClose={() => setOpen(null)} onConnect={(p) => connect(open, p)} onOpen={openObject} />}
    </main>
  );
}

function Overlay({
  id,
  origin,
  clipped,
  onClose,
  onConnect,
  onOpen,
}: {
  id: ObjectId;
  origin: DOMRect | null;
  clipped: boolean;
  onClose: () => void;
  onConnect: (p: ProjectId) => void;
  onOpen: (id: ObjectId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onClose);
  const obj = deskObjects.find((o) => o.id === id)!;

  // the view grows out of the object you picked up
  useEffect(() => {
    const el = ref.current;
    if (!el || !origin || prefersReducedMotion()) return;
    const to = el.getBoundingClientRect();
    el.animate(
      [
        { transform: `translate(${origin.left + origin.width / 2 - (to.left + to.width / 2)}px, ${origin.top + origin.height / 2 - (to.top + to.height / 2)}px) scale(${Math.max(0.15, origin.width / to.width)})`, opacity: 0.3 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(.22,.8,.2,1)" },
    );
  }, [origin]);

  return (
    <div className="desk-scrim" onClick={onClose}>
      <div className={`desk-view desk-view--${obj.interaction} desk-view--${id}`} role="dialog" aria-modal="true" aria-labelledby="desk-view-title" ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="desk-view__close" onClick={onClose} data-autofocus>
          Put it down
        </button>
        <View id={id} clipped={clipped} onConnect={onConnect} onOpen={onOpen} onClose={onClose} />
      </div>
    </div>
  );
}

/** Easter egg: a paperclip you can drag onto the letter (or clip with the keyboard). */
function Paperclip({ deskRef, onClip }: { deskRef: React.RefObject<HTMLDivElement | null>; onClip: () => void }) {
  const [pos, setPos] = useState({ x: 27, y: 46 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const toPct = (cx: number, cy: number) => {
    const r = deskRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100 };
  };
  return (
    <button
      className="desk-clip"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      aria-label="A loose paperclip. Press Enter to clip it to the letter, or drag it there."
      onKeyDown={(e) => e.key === "Enter" && onClip()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { dx: 0, dy: 0 };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setPos(toPct(e.clientX, e.clientY));
      }}
      onPointerUp={(e) => {
        drag.current = null;
        const p = toPct(e.clientX, e.clientY);
        const l = layout.letter;
        if (p.x > l.x - 2 && p.x < l.x + l.w + 2 && p.y > l.y - 4 && p.y < l.y + 26) onClip();
      }}
    >
      <svg viewBox="0 0 20 50" aria-hidden="true">
        <path d="M6 14 V40 a4 4 0 0 0 8 0 V8 a6 6 0 0 0 -12 0 V38 a8 8 0 0 0 16 0 V14" fill="none" stroke="#9d98a4" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
