import { useEffect, useRef, useState } from "react";
import { href } from "../../lib/router";
import { asset } from "../../lib/asset";
import { prefersReducedMotion } from "../../lib/motion";
import { Reveal, SplitWords, useParallax, useScrollProgress } from "../../lib/scroll";
import { flavours, formats, roadTripBox } from "./data";
import { base, useShop } from "./SailorSprings";
import { money } from "./bag";

export function Home() {
  return (
    <>
      <Hero />
      <Manifesto />
      <RoadStory />
      <Lineup />
      <Source />
      <ShopRail />
      <BoxFeature />
      <FinderBand />
    </>
  );
}

/* ------------------------------------------------------------------ */
function Hero() {
  const ref = useRef<HTMLElement>(null);
  useParallax(ref);
  return (
    <section className="ssh-hero" ref={ref} aria-labelledby="ssh-title">
      <div className="ssh-hero__media">
        <img src={asset("img/sailor/hero.webp")} alt="Three Sailor Springs cans — Lighthouse Lemon, Low Tide and Night Swim — on plaster blocks in palm-shadowed afternoon sun" fetchPriority="high" />
      </div>
      <div className="ssh-hero__shade" aria-hidden="true" />
      <div className="ssh-hero__content">
        <p className="ssh-kicker">
          <span>Sparkling botanical water</span>
          <span>Bottled at mile 36</span>
        </p>
        <h1 id="ssh-title" className="ssh-hero__title">
          <SplitWords text="The coast road," className="ssh-hero__line" />
          <SplitWords text="bottled." className="ssh-hero__line ssh-hero__line--italic" delay={260} />
        </h1>
        <div className="ssh-hero__foot">
          <Reveal as="p" className="ssh-hero__lede" delay={600}>
            Six flavours from a thirty-six-mile drive to a mineral spring on the edge of the Pacific. Sweetened only by the fruit in it.
          </Reveal>
          <Reveal className="ssh-hero__ctas" delay={760}>
            <a className="ss-btn ss-btn--light" href={href(`${base}/shop`)}>
              Shop the six
            </a>
            <a
              className="ss-btn ss-btn--ghost-light"
              href="#ss-road"
              onClick={(e) => (e.preventDefault(), document.getElementById("ss-road")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" }))}
            >
              Take the road
            </a>
          </Reveal>
        </div>
      </div>
      <span className="ssh-hero__scroll" aria-hidden="true">
        Scroll
      </span>
    </section>
  );
}

/* ------------------------------------------------------------------ */
const manifesto =
  "We don't bottle a flavour. We bottle a place. Six stops on one coast road, each with its own weather, its own fruit and its own reason to pull over.";

function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, "through");
  const words = manifesto.split(" ");
  // words light up as the paragraph passes through the middle of the screen
  const lit = Math.round(Math.max(0, Math.min(1, (p - 0.22) / 0.42)) * words.length);
  return (
    <section className="ssh-manifesto" ref={ref}>
      <p className="ssh-manifesto__label">Mile 0</p>
      <p className="ssh-manifesto__text" aria-label={manifesto}>
        {words.map((w, i) => (
          <span key={i} className={i < lit || prefersReducedMotion() ? "is-lit" : ""} aria-hidden="true">
            {w}{" "}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/** The signature: a pinned drive down the coast road. Each stop repaints the section in its flavour's weather. */
function RoadStory() {
  const { add } = useShop();
  const track = useRef<HTMLElement>(null);
  const p = useScrollProgress(track, "track");
  const n = flavours.length;
  const index = Math.min(n - 1, Math.floor(p * n * 0.999));
  const f = flavours[index];
  const w = f.weather;
  const jump = (i: number) => {
    const el = track.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((i + 0.5) / n), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <section className="ssh-road" id="ss-road" ref={track} style={{ height: `${n * 85 + 40}vh` }} aria-label="The coast road, one stop per flavour">
      <div
        className={`ssh-road__stage ${f.id === "night-swim" ? "is-night" : ""}`}
        style={{ "--r-sky": w.sky, "--r-sea": w.sea, "--r-ink": w.ink, "--r-accent": w.accent, "--r-sun": w.sun } as React.CSSProperties}
      >
        <div className="ssh-road__sun" aria-hidden="true" style={{ transform: `translate(-50%, ${(1 - (p * n - index)) * 8}%)` }} />
        <svg className="ssh-road__map" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 20 C 120 6, 220 34, 340 20 S 560 4, 680 20 S 880 34, 1000 18" className="ssh-road__line" />
          <clipPath id="ssh-road-clip">
            <rect width={p * 1000} height="40" />
          </clipPath>
          <path d="M0 20 C 120 6, 220 34, 340 20 S 560 4, 680 20 S 880 34, 1000 18" className="ssh-road__done" clipPath="url(#ssh-road-clip)" />
        </svg>
        <ol className="ssh-road__stops">
          {flavours.map((x, i) => (
            <li key={x.id}>
              <button aria-current={i === index ? "step" : undefined} onClick={() => jump(i)}>
                <span>Mile {x.mile}</span>
                <strong>{x.name}</strong>
              </button>
            </li>
          ))}
        </ol>

        <div className="ssh-road__grid">
          <div className="ssh-road__copy" key={f.id} aria-live="polite">
            <p className="ssh-road__mile">
              <span className="ssh-road__num">{f.mile}</span>
              <span>miles from town · {f.place}</span>
            </p>
            <h2 className="ssh-road__name">{f.name}</h2>
            <p className="ssh-road__sub">{f.line}</p>
            <p className="ssh-road__story">{f.story}</p>
            <div className="ssh-road__actions">
              <button className="ss-btn ss-btn--road" onClick={() => add({ product: f.id, format: formats[0].id, qty: 1 })}>
                Add a 4-pack — {money(formats[0].price)}
              </button>
              <a className="ss-textlink" href={href(`${base}/shop/${f.id}`)}>
                Tasting notes
              </a>
            </div>
          </div>
          <div className="ssh-road__photos">
            {flavours.map((x, i) => (
              <img
                key={x.id}
                src={asset(`img/sailor/portrait-${x.id}.webp`)}
                alt={i === index ? `${x.name} can on a plinth in ${x.place} light` : ""}
                aria-hidden={i !== index}
                loading={i < 2 ? "eager" : "lazy"}
                className={i === index ? "is-on" : i < index ? "is-past" : ""}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Lineup() {
  const ref = useRef<HTMLElement>(null);
  useParallax(ref);
  return (
    <section className="ssh-lineup" ref={ref}>
      <Reveal kind="clip" className="ssh-lineup__frame">
        <img src={asset("img/sailor/lineup.webp")} alt="All six Sailor Springs flavours lined up on a plaster shelf in afternoon light" loading="lazy" />
      </Reveal>
      <div className="ssh-lineup__caption">
        <Reveal as="h2" className="ssh-display">
          Six stops. <em>One road.</em>
        </Reveal>
        <Reveal as="p" delay={120}>
          Every can carries its mile number like a road sign — so you always know where your flavour came from.
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Source() {
  const ref = useRef<HTMLElement>(null);
  useParallax(ref);
  const points = [
    ["The spring", "Naturally soft mineral water from the cliff at mile 36. Every flavour is built on it."],
    ["The fruit", "Sweet only from fruit and botanicals — between zero and three grams of sugar a can."],
    ["The rule", "If there's rosemary on the label, there was rosemary in the tank. No “natural flavours”."],
  ];
  return (
    <section className="ssh-source" ref={ref}>
      <div className="ssh-source__img">
        <Reveal kind="clip">
          <img src={asset("img/sailor/ice.webp")} alt="A Fog Line can resting in ice, seen from above" loading="lazy" />
        </Reveal>
        <span className="ssh-source__tag">Fog Line · Mile 23</span>
      </div>
      <div className="ssh-source__text">
        <Reveal as="h2" className="ssh-display">
          Built on <em>one spring.</em>
        </Reveal>
        <dl>
          {points.map(([t, b], i) => (
            <Reveal key={t} delay={i * 120}>
              <dt>{t}</dt>
              <dd>{b}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function ShopRail() {
  const { add } = useShop();
  const rail = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const on = () => {
      setAtStart(el.scrollLeft < 10);
      setAtEnd(el.scrollLeft + el.clientWidth > el.scrollWidth - 10);
    };
    on();
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);
  const nudge = (d: number) => rail.current?.scrollBy({ left: d * rail.current.clientWidth * 0.8, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  return (
    <section className="ssh-rail" aria-labelledby="ssh-rail-title">
      <div className="ssh-rail__head">
        <Reveal as="h2" className="ssh-display" id="ssh-rail-title">
          Pick your mile.
        </Reveal>
        <div className="ssh-rail__nav">
          <button onClick={() => nudge(-1)} disabled={atStart} aria-label="Scroll flavours left">
            ←
          </button>
          <button onClick={() => nudge(1)} disabled={atEnd} aria-label="Scroll flavours right">
            →
          </button>
        </div>
      </div>
      <div className="ssh-rail__track" ref={rail} tabIndex={0} aria-label="Flavours">
        {flavours.map((f, i) => (
          <Reveal key={f.id} as="article" className="ssh-card" delay={i * 70} style={{ "--c-sky": f.weather.sky, "--c-sun": f.weather.sun, "--c-ink": f.weather.labelInk, "--c-label": f.weather.label } as React.CSSProperties}>
            <a className="ssh-card__media" href={href(`${base}/shop/${f.id}`)} aria-label={`${f.name} — view`}>
              <span className="ssh-card__sun" aria-hidden="true" />
              <img src={asset(`img/sailor/can-${f.id}.webp`)} alt="" loading="lazy" />
              <span className="ssh-card__mile">Mile {f.mile}</span>
            </a>
            <div className="ssh-card__body">
              <h3>
                <a href={href(`${base}/shop/${f.id}`)}>{f.name}</a>
              </h3>
              <p>{f.line}</p>
              <button className="ssh-card__add" onClick={() => add({ product: f.id, format: formats[0].id, qty: 1 })} aria-label={`Add a 4-pack of ${f.name}, ${money(formats[0].price)}`}>
                <span>Add 4-pack</span>
                <span>{money(formats[0].price)}</span>
              </button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function BoxFeature() {
  const { add } = useShop();
  return (
    <section className="ssh-box">
      <Reveal kind="clip" className="ssh-box__img">
        <img src={asset("img/sailor/box.webp")} alt="The Whole Road box: twelve cans, two of each flavour, in a kraft case" loading="lazy" />
      </Reveal>
      <div className="ssh-box__text">
        <Reveal as="p" className="ssh-eyebrow-line">
          Can't choose?
        </Reveal>
        <Reveal as="h2" className="ssh-display" delay={80}>
          The Whole Road.
        </Reveal>
        <Reveal as="p" delay={160}>
          {roadTripBox.detail}, packed in the order you'd pass them on the drive. The best way to find your mile.
        </Reveal>
        <Reveal delay={240}>
          <button className="ss-btn" onClick={() => add({ product: roadTripBox.id, format: "box", qty: 1 })}>
            Add the box — {money(roadTripBox.price)}
          </button>
        </Reveal>
      </div>
    </section>
  );
}

function FinderBand() {
  return (
    <section className="ssh-finder">
      <Reveal as="h2" className="ssh-finder__title">
        Not sure which mile is yours?
      </Reveal>
      <Reveal as="p" delay={100}>
        Three questions about when and how you drink. One recommendation, with the reasons.
      </Reveal>
      <Reveal delay={200}>
        <a className="ss-btn ss-btn--light" href={href(`${base}/finder`)}>
          Find your mile
        </a>
      </Reveal>
    </section>
  );
}
