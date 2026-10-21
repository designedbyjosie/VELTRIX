import { useState } from "react";
import { href } from "../../lib/router";
import { asset } from "../../lib/asset";
import { Reveal } from "../../lib/scroll";
import { flavours, formats, roadTripBox, type Flavour } from "./data";
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
  const { add } = useShop();
  const [mood, setMood] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("road");

  const list = flavours
    .filter((f) => !mood || f.mood.includes(mood as Flavour["mood"][number]))
    .sort((a, b) => (sort === "road" ? a.mile - b.mile : sort === "sweet" ? b.sweetness - a.sweetness : a.sweetness - b.sweetness));

  return (
    <div className="ss-shop">
      <header className="ss-pagehead">
        <Reveal as="p" className="ssh-eyebrow-line">
          The range · six flavours
        </Reveal>
        <Reveal as="h1" className="ss-pagehead__title" delay={60}>
          Shop <em>the road.</em>
        </Reveal>
        <Reveal as="p" className="ss-pagehead__lede" delay={140}>
          Sparkling botanical water, sweetened only by the fruit in it. 0–3 g of sugar a can, nothing artificial, and a mile marker on every label.
        </Reveal>
      </header>

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
          Order
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="road">By mile marker</option>
            <option value="sweet">Fruitiest first</option>
            <option value="dry">Driest first</option>
          </select>
        </label>
      </div>
      <p className="sr-only" aria-live="polite">
        Showing {list.length} flavours
      </p>

      <ul className="ss-grid">
        {list.map((f, i) => (
          <Reveal as="li" key={f.id} className="ssh-card ssh-card--grid" delay={(i % 3) * 80} style={{ "--c-sky": f.weather.sky, "--c-sun": f.weather.sun, "--c-ink": f.weather.labelInk, "--c-label": f.weather.label } as React.CSSProperties}>
            <a className="ssh-card__media" href={href(`${base}/shop/${f.id}`)} aria-label={`${f.name} — details`}>
              <span className="ssh-card__sun" aria-hidden="true" />
              <img src={asset(`img/sailor/can-${f.id}.webp`)} alt="" loading="lazy" />
              <span className="ssh-card__mile">Mile {f.mile}</span>
            </a>
            <div className="ssh-card__body">
              <h2>
                <a href={href(`${base}/shop/${f.id}`)}>{f.name}</a>
              </h2>
              <p>{f.line}</p>
              <button className="ssh-card__add" onClick={() => add({ product: f.id, format: "4", qty: 1 })} aria-label={`Add a 4-pack of ${f.name}`}>
                <span>Add 4-pack</span>
                <span>{money(formats[0].price)}</span>
              </button>
            </div>
          </Reveal>
        ))}
        {list.length === 0 && (
          <li className="ss-empty">
            Nothing matches that mood.{" "}
            <button className="ss-textlink" onClick={() => setMood(null)}>
              Show all six
            </button>
          </li>
        )}
      </ul>

      <section className="ssh-box ssh-box--shop" aria-labelledby="ss-box-title">
        <Reveal kind="clip" className="ssh-box__img">
          <img src={asset("img/sailor/box.webp")} alt="Twelve cans in a kraft box" loading="lazy" />
        </Reveal>
        <div className="ssh-box__text">
          <h2 id="ss-box-title" className="ssh-display">
            {roadTripBox.name}.
          </h2>
          <p>{roadTripBox.detail}, packed in the order you'd pass them on the drive.</p>
          <button className="ss-btn" onClick={() => add({ product: roadTripBox.id, format: "box", qty: 1 })}>
            Add the box — {money(roadTripBox.price)}
          </button>
        </div>
      </section>
    </div>
  );
}
