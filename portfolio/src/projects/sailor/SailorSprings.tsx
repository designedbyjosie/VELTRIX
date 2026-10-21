import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource/bricolage-grotesque/400.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/800.css";
import { usePersistentState } from "../../lib/storage";
import { href } from "../../lib/router";
import { useScrolled } from "../../lib/scroll";
import { flavours, flavourById, type Flavour } from "./data";
import { addLine, setQty, totals, type BagLine } from "./bag";
import { Home } from "./Home";
import { Shop } from "./Shop";
import { Product } from "./Product";
import { Story } from "./Story";
import { Finder } from "./Finder";
import { Bag } from "./Bag";
import { Footer } from "./Footer";
import "./sailor.css";

interface ShopState {
  flavour: Flavour;
  setFlavour: (id: string) => void;
  bag: BagLine[];
  add: (line: BagLine) => void;
  update: (key: string, qty: number) => void;
  openBag: () => void;
}

const Ctx = createContext<ShopState | null>(null);
export function useShop() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShop outside Sailor Springs");
  return c;
}

export const base = "/work/sailor-springs";

export default function SailorSprings({ path }: { path: string[] }) {
  const [flavourId, setFlavourId] = usePersistentState("ss.flavour", flavours[0].id);
  const [bag, setBag] = usePersistentState<BagLine[]>("ss.bag", []);
  const [bagOpen, setBagOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const scrolled = useScrolled(60);

  const routeFlavour = path[0] === "shop" && path[1] ? flavourById(path[1]) : undefined;
  const flavour = routeFlavour ?? flavourById(flavourId) ?? flavours[0];

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => setMenu(false), [path.join("/")]);

  const add = useCallback(
    (line: BagLine) => {
      setBag((b) => addLine(b, line));
      const name = flavourById(line.product)?.name ?? "The Whole Road";
      setToast({ text: `${line.qty} × ${name} added`, id: Date.now() });
    },
    [setBag],
  );

  const value = useMemo<ShopState>(
    () => ({ flavour, setFlavour: setFlavourId, bag, add, update: (key, qty) => setBag((b) => setQty(b, key, qty)), openBag: () => setBagOpen(true) }),
    [flavour, setFlavourId, bag, add, setBag],
  );

  const w = flavour.weather;
  const style = {
    "--ss-sky": w.sky,
    "--ss-sea": w.sea,
    "--ss-ink": w.ink,
    "--ss-accent": w.accent,
    "--ss-sun": w.sun,
    "--ss-label": w.label,
  } as React.CSSProperties;

  let page: React.ReactNode;
  let overHero = false;
  if (path[0] === "shop" && path[1] && routeFlavour) page = <Product flavour={routeFlavour} />;
  else if (path[0] === "shop") page = <Shop />;
  else if (path[0] === "story") page = <Story />;
  else if (path[0] === "finder") page = <Finder />;
  else {
    page = <Home />;
    overHero = true;
  }

  const count = totals(bag).items;
  const here = path[0] ?? "";
  const links: [string, string][] = [
    ["shop", "Shop"],
    ["story", "The road"],
    ["finder", "Find your mile"],
  ];

  return (
    <Ctx.Provider value={value}>
      <div className={`ss ${flavour.id === "night-swim" ? "ss--night" : ""}`} style={style}>
        <a className="ss-skip" href="#ss-main" onClick={(e) => (e.preventDefault(), document.getElementById("ss-main")?.focus())}>
          Skip to content
        </a>
        <header className={`ss-nav ${scrolled || !overHero ? "is-solid" : ""} ${menu ? "is-menu" : ""}`}>
          <a className="ss-mark" href={href(base)} aria-label="Sailor Springs home">
            <span className="ss-mark__word">Sailor Springs</span>
            <span className="ss-mark__mile" aria-hidden="true">
              Mile 0 — 36
            </span>
          </a>
          <nav className="ss-nav__links" aria-label="Sailor Springs">
            {links.map(([to, label]) => (
              <a key={to} href={href(`${base}/${to}`)} aria-current={here === to ? "page" : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <div className="ss-nav__right">
            <button className="ss-bagbtn" onClick={() => setBagOpen(true)} aria-label={`Open bag, ${count} items`}>
              <span>Bag</span>
              <span className="ss-bagbtn__count" key={count}>
                {count}
              </span>
            </button>
            <button className="ss-burger" aria-expanded={menu} aria-controls="ss-menu" onClick={() => setMenu((m) => !m)}>
              <span className="sr-only">Menu</span>
              <i />
              <i />
            </button>
          </div>
        </header>
        <div className={`ss-menu ${menu ? "is-open" : ""}`} id="ss-menu" hidden={!menu}>
          {links.map(([to, label], i) => (
            <a key={to} href={href(`${base}/${to}`)} style={{ transitionDelay: `${80 + i * 60}ms` }}>
              {label}
            </a>
          ))}
        </div>
        <main id="ss-main" tabIndex={-1} key={path.join("/")} className="ss-page">
          {page}
        </main>
        <Footer />
        <Bag open={bagOpen} onClose={() => setBagOpen(false)} />
        <div className="ss-toast" role="status" aria-live="polite">
          {toast && (
            <span key={toast.id}>
              {toast.text}
              <button onClick={() => setBagOpen(true)}>View bag</button>
            </span>
          )}
        </div>
      </div>
    </Ctx.Provider>
  );
}
