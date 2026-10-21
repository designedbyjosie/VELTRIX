import { useEffect, useState } from "react";
import { href } from "../../lib/router";
import { asset } from "../../lib/asset";
import { Reveal } from "../../lib/scroll";
import { flavours, formats, type Flavour } from "./data";
import { Motif } from "./Can";
import { base, useShop } from "./SailorSprings";
import { money, MAX_QTY } from "./bag";

type View = "photo" | "can" | "label" | "ice";

export function Product({ flavour: f }: { flavour: Flavour }) {
  const { add, setFlavour } = useShop();
  const [format, setFormat] = useState(formats[1].id);
  const [qty, setQty] = useState(1);
  const [view, setView] = useState<View>("photo");
  const fmt = formats.find((x) => x.id === format)!;
  const idx = flavours.indexOf(f);
  const prev = flavours[(idx - 1 + flavours.length) % flavours.length];
  const next = flavours[(idx + 1) % flavours.length];

  useEffect(() => {
    setFlavour(f.id);
    setView("photo");
    setQty(1);
  }, [f.id, setFlavour]);

  const views: [View, string][] = [
    ["photo", "In the light"],
    ["can", "The can"],
    ["label", "Label, unwrapped"],
    ...(f.id === "fog-line" ? ([["ice", "On ice"]] as [View, string][]) : []),
  ];

  return (
    <article className="ss-pdp">
      <nav className="ss-crumbs" aria-label="Breadcrumb">
        <a href={href(`${base}/shop`)}>The range</a> <span aria-hidden="true">/</span> <span aria-current="page">{f.name}</span>
      </nav>

      <div className="ss-pdp__grid">
        <div className="ss-pdp__media">
          <div className={`ss-pdp__stage ss-pdp__stage--${view}`}>
            {view === "photo" && <img key="photo" src={asset(`img/sailor/portrait-${f.id}.webp`)} alt={`${f.name} on a plinth in dappled afternoon light`} />}
            {view === "can" && (
              <div className="ss-pdp__can" key="can">
                <span className="ss-pdp__sun" aria-hidden="true" />
                <img src={asset(`img/sailor/can-${f.id}.webp`)} alt={`${f.name} can, front`} />
              </div>
            )}
            {view === "label" && <LabelFlat flavour={f} />}
            {view === "ice" && <img key="ice" src={asset("img/sailor/ice.webp")} alt="Fog Line resting in ice" />}
          </div>
          <div className="ss-views" role="tablist" aria-label="Product images">
            {views.map(([v, label]) => (
              <button key={v} role="tab" aria-selected={view === v} className="ss-views__tab" onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ss-pdp__info">
          <p className="ss-pdp__mile">
            <span>Mile {f.mile}</span> {f.place}
          </p>
          <h1>{f.name}</h1>
          <p className="ss-pdp__line">{f.line}</p>
          <p className="ss-pdp__story">{f.story}</p>

          <dl className="ss-meters">
            <Meter label="Fruit sweetness" value={f.sweetness} max={3} />
            <Meter label="Botanical" value={f.botanical} max={3} />
            <div className="ss-meter">
              <dt>Bubbles</dt>
              <dd>{f.fizz === "fine" ? "Fine, like Champagne" : f.fizz === "lively" ? "Lively" : "Big and bracing"}</dd>
            </div>
          </dl>

          <ul className="ss-notes" aria-label="Tasting notes">
            {f.tasting.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>

          <fieldset className="ss-formats">
            <legend>Size</legend>
            {formats.map((x) => (
              <label key={x.id} className={`ss-format ${format === x.id ? "is-on" : ""}`}>
                <input type="radio" name="format" value={x.id} checked={format === x.id} onChange={() => setFormat(x.id)} />
                <span className="ss-format__name">{x.name}</span>
                <span className="ss-format__detail">{x.detail}</span>
                <span className="ss-format__price">{money(x.price)}</span>
              </label>
            ))}
          </fieldset>

          <div className="ss-purchase">
            <div className="ss-stepper" role="group" aria-label="Quantity">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One fewer" disabled={qty <= 1}>
                −
              </button>
              <output aria-live="polite">{qty}</output>
              <button onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))} aria-label="One more" disabled={qty >= MAX_QTY}>
                +
              </button>
            </div>
            <button className="ss-btn ss-btn--wide" onClick={() => add({ product: f.id, format, qty })}>
              Add to bag — {money(fmt.price * qty)}
            </button>
          </div>
          <p className="ss-pdp__ship">Free shipping over $40 · Concept store: checkout is switched off.</p>
          <p className="ss-pdp__good">
            <span>Good for</span> {f.occasions.join(", ").toLowerCase()}.
          </p>
        </div>
      </div>

      <section className="ss-pdp__place">
        <Reveal as="p" className="ssh-eyebrow-line">
          Where it's from
        </Reveal>
        <Reveal as="h2" className="ssh-display" delay={60}>
          Mile {f.mile}, <em>{f.place}.</em>
        </Reveal>
        <Reveal className="ss-miniroad" delay={120}>
          <svg viewBox="0 0 1000 120" role="img" aria-label={`Map of the coast road with ${f.name} at mile ${f.mile} of 36`}>
            <path d={roadPath} className="ss-miniroad__path" />
            {flavours.map((x) => {
              const [cx, cy] = roadPoint(x.mile / 36);
              return (
                <g key={x.id} className={x.id === f.id ? "is-here" : ""}>
                  <circle cx={cx} cy={cy} r={x.id === f.id ? 12 : 6} />
                  <text x={cx} y={cy - 22} textAnchor="middle">
                    {x.mile}
                  </text>
                </g>
              );
            })}
          </svg>
        </Reveal>
      </section>

      <nav className="ss-pdp__next" aria-label="Other flavours">
        <a href={href(`${base}/shop/${prev.id}`)} style={{ "--c-sky": prev.weather.sky, "--c-ink": prev.weather.ink } as React.CSSProperties}>
          <span>Back down the road</span>
          <strong>{prev.name}</strong>
          <img src={asset(`img/sailor/can-${prev.id}.webp`)} alt="" loading="lazy" />
        </a>
        <a href={href(`${base}/shop/${next.id}`)} style={{ "--c-sky": next.weather.sky, "--c-ink": next.weather.ink } as React.CSSProperties}>
          <span>Further down the road</span>
          <strong>{next.name}</strong>
          <img src={asset(`img/sailor/can-${next.id}.webp`)} alt="" loading="lazy" />
        </a>
      </nav>
    </article>
  );
}

/** The coast road as a gentle wave; stops sit exactly on it. */
const roadPoint = (t: number) => [10 + t * 980, 66 - Math.sin(t * Math.PI * 2.1) * 24] as const;
const roadPath = "M" + Array.from({ length: 61 }, (_, i) => roadPoint(i / 60).map((v) => v.toFixed(1)).join(" ")).join(" L");

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="ss-meter">
      <dt>{label}</dt>
      <dd>
        <span className="ss-meter__dots" aria-hidden="true">
          {Array.from({ length: max }, (_, i) => (
            <i key={i} className={i < value ? "on" : ""} />
          ))}
        </span>
        <span className="sr-only">
          {value} of {max}
        </span>
      </dd>
    </div>
  );
}

/** The label as a printer would see it: flat, with the back panel copy. */
export function LabelFlat({ flavour: f }: { flavour: Flavour }) {
  const w = f.weather;
  return (
    <svg viewBox="0 0 520 260" className="ss-label-flat" role="img" aria-label={`${f.name} label laid flat`}>
      <rect width="520" height="260" fill={w.label} />
      <rect width="520" height="34" fill={w.band} />
      <text x="20" y="23" fontFamily="'Bricolage Grotesque'" fontWeight="800" fontSize="13" letterSpacing="2" fill={w.label}>
        SAILOR SPRINGS · SPARKLING BOTANICAL WATER · MILE {f.mile}
      </text>
      <circle cx="130" cy="130" r="58" fill={w.sun} />
      <g transform="translate(130 130) scale(1.8)">
        <Motif kind={f.motif} color={w.label} ink={w.labelInk} />
      </g>
      <text x="130" y="226" textAnchor="middle" fontFamily="'DM Serif Display'" fontSize="30" fill={w.labelInk}>
        {f.name}
      </text>
      <line x1="260" y1="50" x2="260" y2="240" stroke={w.labelInk} strokeOpacity=".3" />
      <text x="282" y="70" fontFamily="'Bricolage Grotesque'" fontWeight="600" fontSize="11" fill={w.labelInk}>
        INGREDIENTS
      </text>
      <text x="282" y="88" fontFamily="'Bricolage Grotesque'" fontSize="11" fill={w.labelInk}>
        Sparkling spring water, {f.line.toLowerCase()}.
      </text>
      <text x="282" y="120" fontFamily="'Bricolage Grotesque'" fontWeight="600" fontSize="11" fill={w.labelInk}>
        FROM THE ROAD
      </text>
      {["Drawn from the spring at Mile 36 and flavoured", "with what grows along the drive out.", "Best cold, best outside."].map((line, i) => (
        <text key={i} x="282" y={138 + i * 16} fontFamily="'Bricolage Grotesque'" fontSize="11" fill={w.labelInk}>
          {line}
        </text>
      ))}
      <rect x="282" y="200" width="90" height="34" fill="none" stroke={w.labelInk} />
      <text x="327" y="222" textAnchor="middle" fontFamily="'Bricolage Grotesque'" fontWeight="800" fontSize="12" fill={w.labelInk}>
        330 ML
      </text>
      <g transform="translate(400 200)">
        {Array.from({ length: 22 }, (_, i) => (
          <rect key={i} x={i * 4} y="0" width={i % 3 ? 1.5 : 2.5} height="34" fill={w.labelInk} />
        ))}
      </g>
    </svg>
  );
}
