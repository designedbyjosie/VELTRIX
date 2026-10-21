import { useState } from "react";
import { href } from "../../lib/router";
import { asset } from "../../lib/asset";
import { recommend, type FinderAnswers } from "./finder";
import { base, useShop } from "./SailorSprings";

const questions = [
  {
    key: "when",
    title: "When are you opening it?",
    options: [
      ["morning", "First thing"],
      ["afternoon", "Mid-afternoon"],
      ["active", "After a swim or a run"],
      ["dinner", "With dinner"],
      ["night", "Late, instead of a nightcap"],
    ],
  },
  {
    key: "sweet",
    title: "How much fruit sweetness?",
    options: [
      [0, "None at all"],
      [1, "A hint"],
      [2, "Some"],
      [3, "Juicy"],
    ],
  },
  {
    key: "taste",
    title: "Which do you reach for?",
    options: [
      ["citrus", "Citrus"],
      ["herbal", "Herbs & green things"],
      ["fruit", "Soft or dark fruit"],
      ["plain", "Just bubbles"],
    ],
  },
] as const;

export function Finder() {
  const { setFlavour, add } = useShop();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<FinderAnswers>>({});
  const done = step >= questions.length;
  const result = done ? recommend(answers as FinderAnswers) : null;

  const choose = (key: string, value: unknown) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step === questions.length - 1) setFlavour(recommend(next as FinderAnswers).best.flavour.id);
    setStep((s) => s + 1);
  };

  return (
    <div className="ss-finder">
      {!done && (
        <section className="ss-finder__q" key={step} aria-labelledby="ss-q">
          <p className="ss-finder__count">
            Question {step + 1} of {questions.length}
          </p>
          <div className="ss-finder__bar" aria-hidden="true">
            <i style={{ width: `${(step / questions.length) * 100}%` }} />
          </div>
          <h1 id="ss-q" className="ss-finder__title">
            {questions[step].title}
          </h1>
          <div className="ss-finder__opts" role="group" aria-labelledby="ss-q">
            {questions[step].options.map(([value, label], i) => (
              <button key={String(value)} className="ss-finder__opt" style={{ animationDelay: `${i * 60}ms` }} onClick={() => choose(questions[step].key, value)}>
                {label}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button className="ss-textlink" onClick={() => setStep((s) => s - 1)}>
              Back to the previous question
            </button>
          )}
        </section>
      )}

      {result && (
        <section className="ss-finder__result" aria-live="polite">
          <img src={asset(`img/sailor/portrait-${result.best.flavour.id}.webp`)} alt={`${result.best.flavour.name} in its own light`} />
          <div className="ss-finder__answer">
            <p className="ss-pdp__mile">
              <span>Your stop is mile {result.best.flavour.mile}</span>
            </p>
            <h1>{result.best.flavour.name}</h1>
            <p className="ss-pdp__line">{result.best.flavour.line}</p>
            <p>We picked it because {result.best.reasons.join(", and ")}.</p>
            <p className="ss-finder__runner">
              Close second: <a href={href(`${base}/shop/${result.runnerUp.flavour.id}`)}>{result.runnerUp.flavour.name}</a>.
            </p>
            <div className="ss-finder__actions">
              <button className="ss-btn" onClick={() => add({ product: result.best.flavour.id, format: "4", qty: 1 })}>
                Add a 4-pack — $9
              </button>
              <a className="ss-textlink" href={href(`${base}/shop/${result.best.flavour.id}`)}>
                Tasting notes
              </a>
              <button
                className="ss-textlink"
                onClick={() => {
                  setAnswers({});
                  setStep(0);
                }}
              >
                Start again
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
