import { useState } from "react";
import { href } from "../../lib/router";
import { flavours, formats, roadTripBox, type Flavour } from "./data";
import { Can } from "./Can";
import { base, useShop } from "./SailorSprings";
import { money } from "./bag";

const moods: { id: Flavour["mood"][number]; label: string }[] = [
  { id: "bright", label: "Bright" },
  { id: "fresh", label: "Fresh & green" },
  { id: "soft", label: "Soft & fruity" },
  { id: "deep", label: "Deep" },
  { id: "calm", label: "Calm" },
  { id: "pure", label: "Unflavoured" },
];

type Sort = "road" | "sweet" | "dry";

export function Shop() {
  const { add, setFlavour, flavour } = useShop();
  const [mood, setMood] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("road");

  const list = flavours
    .filter((f) => !mood || f.mood.includes(mood as Flavour["mood"][number]))
    .sort((a, b) => (sort === "road" ? a.mile - b.mile : sort === "sweet" ? b.sweetness - a.sweetness : a.sweetness - b.sweetness));

  return (
    <div className="ss-shop">
      <div className="ss-section-head ss-section-head--page">
        <h1>The range</h1>
        <p>Sparkling botanical water, sweetened only by the fruit in it. 0–3 g of sugar per can, nothing artificial.</p>
      </div>

      <div className="ss-filters">
        <div className="ss-chips" role="group" aria-label="Filter by mood">
          <button className="ss-chip" aria-pressed={mood === null} onClick={() => setMood(null)}>
            All six
          </button>
          {moods.map((m) => (
            <button key={m.id} className="ss-chip" aria-pressed={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <label className="ss-sort">
          Order by
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="road">Mile marker</option>
            <option value="sweet">Fruitiest first</option>
            <option value="dry">Driest first</option>
          </select>
        </label>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {list.length} flavours
      </p>

      <ul className="ss-grid">
        {list.map((f) => (
          <li
            key={f.id}
            className={`ss-card ${f.id === flavour.id ? "is-current" : ""}`}
            style={{ "--card": f.weather.label, "--card-ink": f.weather.labelInk, "--card-sky": f.weather.sky } as React.CSSProperties}
            onMouseEnter={() => setFlavour(f.id)}
          >
            <a className="ss-card__visual" href={href(`${base}/shop/${f.id}`)} aria-label={`${f.name} — details`} onFocus={() => setFlavour(f.id)}>
              <span className="ss-card__sun" />
              <Can flavour={f} className="ss-card__can" />
            </a>
            <div className="ss-card__body">
              <p className="ss-card__mile">Mile {f.mile}</p>
              <h2>
                <a href={href(`${base}/shop/${f.id}`)}>{f.name}</a>
              </h2>
              <p className="ss-card__line">{f.line}</p>
              <div className="ss-card__buy">
                <span>From {money(formats[0].price)}</span>
                <button className="ss-btn ss-btn--small" onClick={() => add({ product: f.id, format: "4", qty: 1 })} aria-label={`Add a 4-pack of ${f.name}`}>
                  Add 4-pack
                </button>
              </div>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="ss-empty">
            Nothing matches that mood.{" "}
            <button className="ss-link" onClick={() => setMood(null)}>
              Show all six flavours
            </button>
          </li>
        )}
      </ul>

      <section className="ss-box" aria-labelledby="ss-box-title">
        <div className="ss-box__cans" aria-hidden="true">
          {flavours.concat(flavours).map((f, i) => (
            <Can key={i} flavour={f} />
          ))}
        </div>
        <div className="ss-box__copy">
          <h2 id="ss-box-title">{roadTripBox.name}</h2>
          <p>{roadTripBox.detail}, packed in the order you'd pass them on the drive. The best way to find your mile.</p>
          <button className="ss-btn" onClick={() => add({ product: roadTripBox.id, format: "box", qty: 1 })}>
            Add the box — {money(roadTripBox.price)}
          </button>
        </div>
      </section>
    </div>
  );
}
