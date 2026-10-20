import { href } from "../../lib/router";
import { flavours, formats } from "./data";
import { Can } from "./Can";
import { CoastRoad } from "./CoastRoad";
import { base, useShop } from "./SailorSprings";
import { money } from "./bag";

export function Home() {
  const { flavour, setFlavour, add } = useShop();
  const four = formats[0];

  return (
    <>
      <section className="ss-hero" aria-labelledby="ss-hero-title">
        <div className="ss-hero__sun" aria-hidden="true" />
        <div className="ss-hero__haze" aria-hidden="true" />
        <div className="ss-hero__copy">
          <h1 id="ss-hero-title" className="ss-hero__title">
            The coast road,
            <br />
            bottled.
          </h1>
          <p className="ss-hero__lede">
            Sparkling botanical water from a mineral spring at the end of a 36-mile road. Six flavours, each named for
            the stop where we first tasted it.
          </p>
        </div>

        <div className="ss-hero__stage">
          <div className="ss-hero__can" key={flavour.id}>
            <Can flavour={flavour} title={`${flavour.name} can`} />
          </div>
          <div className="ss-hero__shadow" aria-hidden="true" />
        </div>

        <div className="ss-hero__card" aria-live="polite">
          <p className="ss-hero__mile">Mile {flavour.mile} · {flavour.place}</p>
          <h2>{flavour.name}</h2>
          <p className="ss-hero__line">{flavour.line}</p>
          <div className="ss-hero__buy">
            <button className="ss-btn" onClick={() => add({ product: flavour.id, format: four.id, qty: 1 })}>
              Add a 4-pack — {money(four.price)}
            </button>
            <a className="ss-link" href={href(`${base}/shop/${flavour.id}`)}>
              Tasting notes and sizes
            </a>
          </div>
        </div>

        <div className="ss-picker" role="radiogroup" aria-label="Choose a flavour — the page takes on its colours">
          {flavours.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={f.id === flavour.id}
              className="ss-picker__item"
              onClick={() => setFlavour(f.id)}
              onKeyDown={(e) => {
                const i = flavours.indexOf(f);
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const n = flavours[(i + 1) % flavours.length];
                  setFlavour(n.id);
                  (e.currentTarget.parentElement?.children[(i + 1) % flavours.length] as HTMLElement)?.focus();
                }
                if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const j = (i - 1 + flavours.length) % flavours.length;
                  setFlavour(flavours[j].id);
                  (e.currentTarget.parentElement?.children[j] as HTMLElement)?.focus();
                }
              }}
              tabIndex={f.id === flavour.id ? 0 : -1}
            >
              <Can flavour={f} className="ss-picker__can" />
              <span className="ss-picker__name">{f.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ss-road-section" aria-labelledby="ss-road-title">
        <div className="ss-section-head">
          <h2 id="ss-road-title">Six stops, one road</h2>
          <p>
            Every flavour is a place on the drive out to the spring. Pick a mile marker to go there — the whole shop takes
            on its weather.
          </p>
        </div>
        <CoastRoad />
      </section>

      <section className="ss-split">
        <a className="ss-split__panel ss-split__panel--finder" href={href(`${base}/finder`)}>
          <span className="ss-split__kicker">Three questions, one can</span>
          <span className="ss-split__title">Find your flavour</span>
          <span className="ss-split__body">Tell us when you're drinking it and how you like it. We'll point you to a mile marker.</span>
        </a>
        <a className="ss-split__panel ss-split__panel--box" href={href(`${base}/shop`)}>
          <span className="ss-split__kicker">Can't choose?</span>
          <span className="ss-split__title">The Whole Road box</span>
          <span className="ss-split__body">Twelve cans, two of every flavour, packed in the order you'd drive past them.</span>
          <span className="ss-split__cans" aria-hidden="true">
            {flavours.map((f) => (
              <Can key={f.id} flavour={f} />
            ))}
          </span>
        </a>
      </section>

      <section className="ss-story-teaser">
        <div className="ss-story-teaser__text">
          <h2>Not a nautical brand. A road-trip brand that happens to end at the sea.</h2>
          <p>
            Sailor Springs is named after the last town on the road — a place with one gas pump, a lighthouse and a
            spring that's been bubbling out of the cliff for longer than anyone has been selling it.
          </p>
          <a className="ss-link" href={href(`${base}/story`)}>
            Read the story of the road
          </a>
        </div>
        <figure className="ss-story-teaser__fig" aria-hidden="true">
          <svg viewBox="0 0 400 300">
            <rect width="400" height="300" fill="var(--ss-sea)" />
            <circle cx="300" cy="90" r="46" fill="var(--ss-sun)" />
            <path d="M0 190 Q100 160 200 186 T400 170 V300 H0Z" fill="var(--ss-sky)" />
            <path d="M-10 300 C80 240 170 230 230 200 S360 150 410 156" stroke="var(--ss-ink)" strokeWidth="3" fill="none" strokeDasharray="10 8" />
            <rect x="320" y="100" width="12" height="60" fill="var(--ss-ink)" />
            <path d="M314 100 h24 l-6 -14 h-12z" fill="var(--ss-accent)" />
          </svg>
        </figure>
      </section>
    </>
  );
}
