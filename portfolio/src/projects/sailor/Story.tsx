import { useRef } from "react";
import { asset } from "../../lib/asset";
import { Reveal, SplitWords, useParallax } from "../../lib/scroll";
import { flavours } from "./data";
import { useShop } from "./SailorSprings";

const chapters = [
  {
    mile: "Mile 0",
    title: "Everything good is at the end of a long drive.",
    body: "The road to Sailor Springs is thirty-six miles of switchbacks, fruit stands and turnouts where people stop to look at the water. At the very end there's a town small enough to walk across in five minutes, and a spring that comes out of the cliff cold and faintly fizzy.",
  },
  {
    mile: "Mile 11",
    title: "What would the drive taste like?",
    body: "Grapefruit from the trees by the rock pools. Chamomile from the lighthouse garden. Bay leaves from the cove nobody admits to swimming in. Every flavour is a stop; every can carries its mile number like a road sign.",
  },
  {
    mile: "Mile 36",
    title: "A road-trip brand that happens to end at the sea.",
    body: "We didn't want another drink covered in anchors. The identity borrows from things you collect on a road trip — faded postcards, enamel mile markers, hand-painted fruit-stand signs — and sets them in clean, modern type.",
  },
];

export function Story() {
  const { flavour, setFlavour } = useShop();
  const hero = useRef<HTMLElement>(null);
  useParallax(hero);
  return (
    <article className="ss-story">
      <header className="ss-story__hero" ref={hero}>
        <div className="ss-story__img">
          <img src={asset("img/sailor/lineup.webp")} alt="The six flavours lined up in afternoon light" />
        </div>
        <h1 className="ss-story__title">
          <SplitWords text="The road," />
          <br />
          <SplitWords text="mile by mile." className="ssh-hero__line--italic" delay={200} />
        </h1>
      </header>

      <div className="ss-chapters">
        {chapters.map((c, i) => (
          <section key={c.mile} className={`ss-chapter ss-chapter--${i % 2 ? "right" : "left"}`}>
            <Reveal as="p" className="ss-chapter__mile">
              {c.mile}
            </Reveal>
            <Reveal as="h2" className="ss-chapter__title" delay={80}>
              {c.title}
            </Reveal>
            <Reveal as="p" className="ss-chapter__body" delay={160}>
              {c.body}
            </Reveal>
          </section>
        ))}
      </div>

      <section className="ss-system" aria-labelledby="ss-system-title">
        <Reveal as="h2" className="ssh-display" id="ss-system-title">
          The identity, <em>taken apart.</em>
        </Reveal>
        <div className="ss-system__grid">
          <Reveal as="figure" className="ss-system__block ss-system__anatomy">
            <div className="ss-anatomy" style={{ background: flavour.weather.sky }}>
              <img src={asset(`img/sailor/can-${flavour.id}.webp`)} alt={`${flavour.name} can`} className="ss-anatomy__can" key={flavour.id} />
              <ol className="ss-anatomy__notes">
                <li style={{ top: "20%" }}>Wordmark band — the flavour's signal colour, the one you spot across a shop.</li>
                <li style={{ top: "38%" }}>The sun: one circle, one motif. Fruit drawn flat, like a stamp.</li>
                <li style={{ top: "60%" }}>Flavour name in a soft serif, one word per line, set big.</li>
                <li style={{ top: "80%" }}>The mile marker — the brand's real logo. It tells you where the flavour is from.</li>
              </ol>
            </div>
            <figcaption>Label anatomy. Pick a palette to see the same structure carry another flavour.</figcaption>
          </Reveal>

          <Reveal as="figure" className="ss-system__block" delay={100}>
            <div className="ss-palette">
              {flavours.map((f) => (
                <button key={f.id} className="ss-palette__col" aria-pressed={f.id === flavour.id} aria-label={`Show ${f.name} palette`} onClick={() => setFlavour(f.id)}>
                  {[f.weather.band, f.weather.label, f.weather.sun, f.weather.sky].map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
            <figcaption>Six “weathers”: four colours for the can and four for the website, per flavour.</figcaption>
          </Reveal>

          <Reveal as="figure" className="ss-system__block ss-type" delay={160}>
            <p className="ss-type__display">
              Postcard <em>Peach</em>
            </p>
            <p className="ss-type__label">SAILOR SPRINGS · MILE 30</p>
            <p className="ss-type__body">DM Serif Display carries the flavour names — warm, a little old-fashioned. Bricolage Grotesque does the hard work: wordmark, prices, buttons, labels.</p>
            <figcaption>Type pairing</figcaption>
          </Reveal>

          <Reveal as="figure" className="ss-system__block ss-markers" delay={220}>
            <div className="ss-markers__row">
              {flavours.map((f) => (
                <span key={f.id} className="ss-marker" style={{ background: f.weather.band, color: f.weather.label }}>
                  <small>MILE</small>
                  {f.mile}
                </span>
              ))}
            </div>
            <figcaption>Mile markers replace nautical clichés as the brand's graphic device — on cans, boxes and the site's map.</figcaption>
          </Reveal>
        </div>
      </section>

      <section className="ss-philosophy">
        <Reveal as="h2" className="ssh-display">
          What goes <em>in the can.</em>
        </Reveal>
        <ul>
          {[
            ["Spring water first.", "Every flavour is built on the same naturally soft mineral water."],
            ["Sweet only from fruit.", "No added sugar, no sweeteners. Between zero and three grams a can."],
            ["Botanicals, not “natural flavours”.", "If there's rosemary on the label, there was rosemary in the tank."],
          ].map(([a, b], i) => (
            <Reveal as="li" key={a} delay={i * 100}>
              <strong>{a}</strong> {b}
            </Reveal>
          ))}
        </ul>
        <p className="ss-philosophy__note">All of the above is fictional brand copy written for this concept.</p>
      </section>
    </article>
  );
}
