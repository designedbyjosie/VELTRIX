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
import { ProjectCover } from "../shell/ProjectCover";
import { asset } from "../lib/asset";
import deskLayout from "./layout.json";
import "../shell/folder.css";
import "./desk.css";

type Box = { x: number; y: number; w: number; h: number };
const L = deskLayout.objects as unknown as Record<string, { bbox: Box; screen?: { x: number; y: number }[] }>;
const box = (id: string): Box => L[id]?.bbox ?? { x: 0, y: 0, w: 0, h: 0 };
/** The live sticky notes sit on the empty part of the felt mat. */
const notesBox: Box = { x: 25.5, y: 32, w: 10.5, h: 16.8 };
/** Stacking follows depth: things nearer the camera (lower on screen) sit on top. */
const depth = (id: ObjectId) => (id === "notes" ? notesBox.y + notesBox.h : box(id).y + box(id).h);
const pinSlots: Record<ProjectId, [number, number]> = { sailor: [0.3, 0.3], lightleak: [0.72, 0.28], ranch: [0.3, 0.72], margin: [0.72, 0.72] };

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

  // the thread drawn across the desk when a discovery connects to a project
  const fromBox = link ? (link.from === "notes" ? notesBox : box(link.from)) : null;
  const pin = box("pinboard");
  const ordered = [...deskObjects].sort((a, b) => depth(a.id) - depth(b.id));

  return (
    <main className={`desk ${arrived ? "is-arrived" : ""}`}>
      <header className="desk-top">
        <a className="pf-pill desk-pill" href={href("/archive")}>
          ← Back to the folder
        </a>
        <div className="desk-top__title">
          <p className="desk-top__eyebrow">About — the person behind the four worlds</p>
          <h1>
            The Creator's <em>Desk</em>
          </h1>
          <p>Everything here belongs to {owner.name}. Pick something up.</p>
        </div>
        <div className="desk-quick" aria-label="Short on time?">
          <span>Short on time?</span>
          <button onClick={(e) => openObject("letter", e.currentTarget)}>Read the letter</button>
          <button onClick={(e) => openObject("envelope", e.currentTarget)}>Get in touch</button>
        </div>
      </header>

      <div className="desk-surface" ref={deskRef}>
        <img className="desk-base" src={asset("img/desk/base.webp")} alt="" decoding="async" fetchPriority="high" />

        {link && fromBox && (
          <svg className="desk-link" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path
              d={`M${fromBox.x + fromBox.w / 2} ${fromBox.y + fromBox.h * 0.3} Q 30 40 ${pin.x + pin.w * pinSlots[link.project][0]} ${pin.y + pin.h * pinSlots[link.project][1]}`}
              className="desk-link__path"
            />
          </svg>
        )}

        <ul className="desk-objects" aria-label="Objects on the desk">
          {ordered.map((o, i) => {
            if (o.id === "notes") {
              return (
                <li key={o.id} className="desk-slot desk-slot--notes" style={{ left: `${notesBox.x}%`, top: `${notesBox.y}%`, width: `${notesBox.w}%`, height: `${notesBox.h}%`, zIndex: i + 1, transitionDelay: `${i * 60}ms` }}>
                  <NotesOnDesk onDiscover={() => discover("notes")} onConnect={(p) => connect("notes", p)} />
                </li>
              );
            }
            const b = box(o.id);
            return (
              <li
                key={o.id}
                className={`desk-slot desk-slot--${o.id} ${found.includes(o.id) ? "is-found" : ""} ${link && o.id === "pinboard" ? "is-linked" : ""} ${o.id === "drawer" && drawerOpen ? "is-open" : ""}`}
                style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, zIndex: i + 1, transitionDelay: `${i * 60}ms` }}
              >
                <button
                  className="desk-object"
                  onClick={(e) => openObject(o.id, e.currentTarget)}
                  aria-label={o.label}
                  aria-expanded={o.id === "drawer" ? drawerOpen : undefined}
                >
                  <ObjectArt id={o.id} />
                  {o.id === "drawer" && <DrawerOpenArt open={drawerOpen} />}
                  {o.id === "laptop" && <LaptopScreen />}
                  {o.id === "letter" && clipped && <span className="desk-letter-clip" aria-hidden="true" />}
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
                  <ObjectArt id={o.id} />
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

/** The card box with its lid up, cross-faded over the closed one. */
function DrawerOpenArt({ open }: { open: boolean }) {
  const c = box("drawer");
  const o = box("drawer-open");
  return (
    <img
      className={`desk-drawer-open ${open ? "is-on" : ""}`}
      src={asset("img/desk/drawer-open.webp")}
      alt=""
      decoding="async"
      draggable={false}
      style={{ left: `${((o.x - c.x) / c.w) * 100}%`, top: `${((o.y - c.y) / c.h) * 100}%`, width: `${(o.w / c.w) * 100}%`, height: `${(o.h / c.h) * 100}%` }}
    />
  );
}

/** A live screen, mapped onto the laptop's display from the render's projected corners. */
function LaptopScreen() {
  const [i, setI] = useState(0);
  const ids: ProjectId[] = ["sailor", "lightleak", "ranch", "margin"];
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = setInterval(() => setI((n) => (n + 1) % ids.length), 3600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const b = box("laptop");
  const pts = L.laptop?.screen;
  if (!pts) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const left = ((Math.min(...xs) - b.x) / b.w) * 100;
  const top = ((Math.min(...ys) - b.y) / b.h) * 100;
  const width = ((Math.max(...xs) - Math.min(...xs)) / b.w) * 100;
  const height = ((Math.max(...ys) - Math.min(...ys)) / b.h) * 100;
  return (
    <span className="desk-screen" aria-hidden="true" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}>
      {ids.map((id, n) => (
        <span key={id} className={`desk-screen__slide ${n === i ? "is-on" : ""}`}>
          <ProjectCover id={id} decorative />
          <span className="desk-screen__caption">{projectById(id)?.title}</span>
        </span>
      ))}
      <span className="desk-screen__glare" />
    </span>
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
  const [pos, setPos] = useState({ x: 50, y: 49 });
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
        const l = box("letter");
        if (p.x > l.x - 2 && p.x < l.x + l.w + 2 && p.y > l.y - 2 && p.y < l.y + l.h + 2) onClip();
      }}
    >
      <svg viewBox="0 0 20 50" aria-hidden="true">
        <path d="M6 14 V40 a4 4 0 0 0 8 0 V8 a6 6 0 0 0 -12 0 V38 a8 8 0 0 0 16 0 V14" fill="none" stroke="#9d98a4" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
