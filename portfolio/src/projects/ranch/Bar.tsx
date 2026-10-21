import { useEffect, useRef, useState, type RefObject } from "react";
import { useScrolled, useScrollProgress } from "../../lib/scroll";
import { useFocusTrap } from "../../lib/useFocusTrap";

export const navItems: [string, string][] = [
  ["cw-story", "Story"],
  ["cw-do", "Things to do"],
  ["cw-lights", "Four lights"],
  ["cw-map", "Map"],
  ["cw-archive", "Archive"],
];

export function go(id: string, smooth = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  // move keyboard focus along with the view — after any closing dialog has restored its own focus
  el.setAttribute("tabindex", "-1");
  window.setTimeout(() => el.focus({ preventScroll: true }), 60);
}

/** Which section is under the reading line, for the bar's active state. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = [...ids, "cw-visit", "cw-intro", "cw-end"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        }),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

const ids = navItems.map(([id]) => id);

export function Bar({ root, reduced, onPlan }: { root: RefObject<HTMLDivElement | null>; reduced: boolean; onPlan: () => void }) {
  const solid = useScrolled(window.innerHeight * 0.7);
  const progress = useScrollProgress(root, "track");
  const active = useActiveSection(ids);
  const [menu, setMenu] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  useFocusTrap(sheet, menu, () => setMenu(false));

  const jump = (id: string) => {
    setMenu(false);
    if (id === "cw-visit") onPlan();
    else go(id, !reduced);
  };

  return (
    <>
      <header className={`cw-bar ${solid ? "is-solid" : ""}`}>
        <a
          className="cw-bar__mark"
          href="#cw-top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
          }}
        >
          <span className="cw-bar__badge" aria-hidden="true">
            CW
          </span>
          Copper Wells
        </a>
        <nav aria-label="Copper Wells Ranch" className="cw-bar__nav">
          {navItems.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              onClick={(e) => (e.preventDefault(), jump(id))}
            >
              {label}
            </a>
          ))}
        </nav>
        <a className="cw-bar__cta" href="#cw-visit" aria-current={active === "cw-visit" ? "location" : undefined} onClick={(e) => (e.preventDefault(), jump("cw-visit"))}>
          Plan a visit
        </a>
        <button className="cw-bar__menu" aria-expanded={menu} aria-controls="cw-menu" onClick={() => setMenu(true)}>
          <span aria-hidden="true" />
          Menu
        </button>
        <span className="cw-bar__rail" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
      </header>

      {menu && (
        <div className="cw-menu" id="cw-menu" role="dialog" aria-modal="true" aria-label="Site menu" ref={sheet}>
          <div className="cw-menu__top">
            <span className="cw-menu__kicker">Copper Wells · Vara Valley</span>
            <button className="cw-menu__close" onClick={() => setMenu(false)} data-autofocus>
              Close
            </button>
          </div>
          <ol className="cw-menu__list">
            {[...navItems, ["cw-visit", "Plan a visit"] as [string, string]].map(([id, label], i) => (
              <li key={id} style={{ "--i": i } as React.CSSProperties}>
                <a href={`#${id}`} onClick={(e) => (e.preventDefault(), jump(id))}>
                  <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
          <p className="cw-menu__foot">A fictional ranch · a self-initiated concept</p>
        </div>
      )}
    </>
  );
}
