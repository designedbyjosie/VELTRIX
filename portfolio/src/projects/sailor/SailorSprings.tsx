import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePersistentState } from "../../lib/storage";
import { href } from "../../lib/router";
import { flavours, flavourById, type Flavour } from "./data";
import { addLine, setQty, totals, type BagLine } from "./bag";
import { Home } from "./Home";
import { Shop } from "./Shop";
import { Product } from "./Product";
import { Story } from "./Story";
import { Finder } from "./Finder";
import { Bag } from "./Bag";
import "./sailor.css";

interface ShopState {
  flavour: Flavour;
  setFlavour: (id: string) => void;
  bag: BagLine[];
  add: (line: BagLine) => void;
  update: (key: string, qty: number) => void;
  openBag: () => void;
  toast: string | null;
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
  const [toast, setToast] = useState<string | null>(null);

  // A product page sets the weather to its own flavour.
  const routeFlavour = path[0] === "shop" && path[1] ? flavourById(path[1]) : undefined;
  const flavour = routeFlavour ?? flavourById(flavourId) ?? flavours[0];

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const add = useCallback(
    (line: BagLine) => {
      setBag((b) => addLine(b, line));
      const name = flavourById(line.product)?.name ?? "The Whole Road";
      setToast(`Added ${line.qty} × ${name} to your bag`);
    },
    [setBag],
  );

  const value = useMemo<ShopState>(
    () => ({
      flavour,
      setFlavour: setFlavourId,
      bag,
      add,
      update: (key, qty) => setBag((b) => setQty(b, key, qty)),
      openBag: () => setBagOpen(true),
      toast,
    }),
    [flavour, setFlavourId, bag, add, setBag, toast],
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
  if (path[0] === "shop" && path[1] && routeFlavour) page = <Product flavour={routeFlavour} />;
  else if (path[0] === "shop") page = <Shop />;
  else if (path[0] === "story") page = <Story />;
  else if (path[0] === "finder") page = <Finder />;
  else page = <Home />;

  const count = totals(bag).items;
  const here = path[0] ?? "";

  return (
    <Ctx.Provider value={value}>
      <div className={`ss ${w.ink.startsWith("#e") || w.ink.startsWith("#f") ? "ss--night" : ""}`} style={style}>
        <a className="ss-skip" href="#ss-main" onClick={(e) => (e.preventDefault(), document.getElementById("ss-main")?.focus())}>
          Skip to content
        </a>
        <header className="ss-bar">
          <a className="ss-mark" href={href(base)} aria-label="Sailor Springs home">
            <span className="ss-mark__word">Sailor Springs</span>
            <span className="ss-mark__sub">bottled at mile 36</span>
          </a>
          <nav className="ss-nav" aria-label="Sailor Springs">
            <a href={href(`${base}/shop`)} aria-current={here === "shop" ? "page" : undefined}>
              Shop
            </a>
            <a href={href(`${base}/story`)} aria-current={here === "story" ? "page" : undefined}>
              The road
            </a>
            <a href={href(`${base}/finder`)} aria-current={here === "finder" ? "page" : undefined}>
              Find your flavour
            </a>
          </nav>
          <button className="ss-bagbtn" onClick={() => setBagOpen(true)} aria-label={`Open bag, ${count} items`}>
            Bag <span className="ss-bagbtn__count">{count}</span>
          </button>
        </header>
        <main id="ss-main" tabIndex={-1}>
          {page}
        </main>
        <footer className="ss-foot">
          <p className="ss-foot__brand">Sailor Springs</p>
          <p>
            A fictional brand and storefront designed as a self-initiated portfolio concept. Nothing here is for sale:
            checkout is switched off and no orders or payments are processed.
          </p>
        </footer>
        <Bag open={bagOpen} onClose={() => setBagOpen(false)} />
        <div className="ss-toast" role="status" aria-live="polite">
          {toast && (
            <span>
              {toast}.{" "}
              <button onClick={() => setBagOpen(true)}>View bag</button>
            </span>
          )}
        </div>
      </div>
    </Ctx.Provider>
  );
}
