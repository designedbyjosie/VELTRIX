import { useRef } from "react";
import { useFocusTrap } from "../../lib/useFocusTrap";
import { href } from "../../lib/router";
import { flavourById } from "./data";
import { Can } from "./Can";
import { base, useShop } from "./SailorSprings";
import { lineKey, lineName, money, totals, unitPrice, FREE_SHIPPING_FROM, MAX_QTY } from "./bag";

export function Bag({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bag, update, add } = useShop();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  const t = totals(bag);
  if (!open) return null;

  return (
    <div className="ss-bag-scrim" onClick={onClose}>
      <aside
        className="ss-bag"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ss-bag-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <header className="ss-bag__head">
          <h2 id="ss-bag-title">Your bag</h2>
          <button className="ss-bag__close" onClick={onClose} data-autofocus>
            Close
          </button>
        </header>

        {bag.length === 0 ? (
          <div className="ss-bag__empty">
            <p>Your bag is empty. Most people start with the spring itself — then drive inland from there.</p>
            <button className="ss-btn" onClick={() => add({ product: "spring-source", format: "4", qty: 1 })}>
              Add a Spring Source 4-pack — $9
            </button>
            <a className="ss-link" href={href(`${base}/shop`)} onClick={onClose}>
              Browse all six flavours
            </a>
          </div>
        ) : (
          <>
            <div className="ss-bag__ship" aria-live="polite">
              {t.toFree > 0 ? (
                <>
                  <span>{money(t.toFree)} away from free shipping</span>
                  <span className="ss-bag__bar">
                    <b style={{ width: `${Math.min(100, (t.subtotal / FREE_SHIPPING_FROM) * 100)}%` }} />
                  </span>
                </>
              ) : (
                <span>Free shipping unlocked</span>
              )}
            </div>
            <ul className="ss-bag__lines">
              {bag.map((l) => {
                const key = lineKey(l);
                const { name, detail } = lineName(l);
                const f = flavourById(l.product);
                return (
                  <li key={key} className="ss-line">
                    <span className="ss-line__thumb" style={{ background: f?.weather.sky ?? "#e4edf5" }}>
                      {f ? <Can flavour={f} /> : <span className="ss-line__box">12</span>}
                    </span>
                    <span className="ss-line__info">
                      <strong>{name}</strong>
                      <span>{detail}</span>
                      <span className="ss-line__controls">
                        <span className="ss-stepper ss-stepper--small" role="group" aria-label={`Quantity of ${name}`}>
                          <button onClick={() => update(key, l.qty - 1)} aria-label={`One fewer ${name}`}>
                            −
                          </button>
                          <output>{l.qty}</output>
                          <button onClick={() => update(key, l.qty + 1)} aria-label={`One more ${name}`} disabled={l.qty >= MAX_QTY}>
                            +
                          </button>
                        </span>
                        <button className="ss-line__remove" onClick={() => update(key, 0)}>
                          Remove
                        </button>
                      </span>
                    </span>
                    <span className="ss-line__price">{money(unitPrice(l) * l.qty)}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="ss-bag__totals">
              <div>
                <dt>Subtotal ({t.items} {t.items === 1 ? "item" : "items"})</dt>
                <dd>{money(t.subtotal)}</dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd>{t.shipping ? money(t.shipping) : "Free"}</dd>
              </div>
              <div className="ss-bag__total">
                <dt>Total</dt>
                <dd>{money(t.total)}</dd>
              </div>
            </dl>
            <button className="ss-btn ss-btn--wide" disabled aria-describedby="ss-checkout-note">
              Checkout
            </button>
            <p id="ss-checkout-note" className="ss-bag__note">
              This is a portfolio concept. Checkout is switched off — no order is placed and no payment is taken. Your bag
              is saved only in this browser.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
