import { flavours } from "./data";
import { Can } from "./Can";
import { useShop } from "./SailorSprings";

export function Story() {
  const { flavour, setFlavour } = useShop();
  return (
    <article className="ss-story">
      <header className="ss-story__head">
        <p className="ss-hero__mile">The road, mile by mile</p>
        <h1>Everything good is at the end of a long drive.</h1>
      </header>

      <section className="ss-story__cols">
        <p className="ss-dropcap">
          The road to Sailor Springs is thirty-six miles of switchbacks, fruit stands and turnouts where people stop to
          look at the water. At the very end there is a town small enough to walk across in five minutes, and a spring
          that comes out of the cliff cold and faintly fizzy.
        </p>
        <p>
          The brand began as a question: what would a drink taste like if it were made from the drive itself? Grapefruit
          from the trees at the rock pools. Chamomile from the lighthouse garden. Bay leaves from the cove nobody admits to
          swimming in. Every flavour is a stop; every can carries its mile number like a road sign.
        </p>
        <p>
          We didn't want another drink covered in anchors. The sea is where the road ends, not what the brand is about.
          So the identity borrows from the things you collect on a road trip instead — faded postcards, enamel mile
          markers, the hand-painted signs on fruit stands — and sets them in clean, modern type.
        </p>
      </section>

      <section className="ss-system" aria-labelledby="ss-system-title">
        <h2 id="ss-system-title">The identity system</h2>
        <div className="ss-system__grid">
          <figure className="ss-system__block ss-system__anatomy">
            <div className="ss-anatomy">
              <Can flavour={flavour} className="ss-anatomy__can" title={`${flavour.name} can, annotated`} />
              <ol className="ss-anatomy__notes">
                <li style={{ top: "12%" }}>Wordmark band — the flavour’s signal colour, the one you spot from across a shop.</li>
                <li style={{ top: "30%" }}>The sun: one circle, one motif. Fruit is drawn flat, like a stamp.</li>
                <li style={{ top: "58%" }}>Flavour name in a soft serif, one word per line, set big.</li>
                <li style={{ top: "84%" }}>The mile marker — the brand's real logo. It tells you where the flavour is from.</li>
              </ol>
            </div>
            <figcaption>Label anatomy. Choose a flavour below to see how the same structure carries six palettes.</figcaption>
          </figure>

          <figure className="ss-system__block">
            <div className="ss-palette">
              {flavours.map((f) => (
                <button
                  key={f.id}
                  className="ss-palette__col"
                  aria-pressed={f.id === flavour.id}
                  aria-label={`Show ${f.name} palette`}
                  onClick={() => setFlavour(f.id)}
                >
                  {[f.weather.band, f.weather.label, f.weather.sun, f.weather.sky].map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
            <figcaption>Six “weathers”. Each flavour owns four colours for its can and four for the website.</figcaption>
          </figure>

          <figure className="ss-system__block ss-type">
            <p className="ss-type__display">Postcard Peach</p>
            <p className="ss-type__label">SAILOR SPRINGS · MILE 30</p>
            <p className="ss-type__body">
              DM Serif Display carries the flavour names — warm, a little old-fashioned. Bricolage Grotesque does the
              hard work: wordmark, prices, buttons, labels. Two families, clearly different jobs.
            </p>
            <figcaption>Type pairing</figcaption>
          </figure>

          <figure className="ss-system__block ss-markers">
            <div className="ss-markers__row">
              {flavours.map((f) => (
                <span key={f.id} className="ss-marker" style={{ background: f.weather.band, color: f.weather.label }}>
                  <small>MILE</small>
                  {f.mile}
                </span>
              ))}
            </div>
            <figcaption>Mile markers replace the usual nautical clichés as the brand's graphic device — on cans, boxes and the shop's map.</figcaption>
          </figure>
        </div>
      </section>

      <section className="ss-philosophy">
        <h2>What goes in the can</h2>
        <ul>
          <li>
            <strong>Spring water first.</strong> Every flavour is built on the same naturally soft mineral water.
          </li>
          <li>
            <strong>Sweet only from fruit.</strong> No added sugar, no sweeteners. Between zero and three grams per can.
          </li>
          <li>
            <strong>Botanicals, not “natural flavours”.</strong> If there's rosemary on the label, there was rosemary in
            the tank.
          </li>
        </ul>
        <p className="ss-philosophy__note">All of the above is fictional brand copy written for this concept.</p>
      </section>
    </article>
  );
}
