import { useState } from "react";
import { href } from "../../lib/router";
import { recommend, type FinderAnswers } from "./finder";
import { Can } from "./Can";
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
    title: "How much fruit sweetness do you like?",
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
    if (step === questions.length - 1) {
      const r = recommend(next as FinderAnswers);
      setFlavour(r.best.flavour.id);
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="ss-finder">
      <div className="ss-section-head ss-section-head--page">
        <h1>Find your flavour</h1>
        <p>Three questions. The page will take on the colours of your match.</p>
      </div>

      <ol className="ss-finder__progress" aria-label="Progress">
        {questions.map((q, i) => (
          <li key={q.key} className={i < step ? "done" : i === step ? "now" : ""}>
            <span className="sr-only">
              Question {i + 1}: {i < step ? "answered" : i === step ? "current" : "not yet"}
            </span>
          </li>
        ))}
      </ol>

      {!done && (
        <fieldset className="ss-finder__q" key={step}>
          <legend>{questions[step].title}</legend>
          <div className="ss-finder__opts">
            {questions[step].options.map(([value, label]) => (
              <button key={String(value)} className="ss-finder__opt" onClick={() => choose(questions[step].key, value)}>
                {label}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button className="ss-link" onClick={() => setStep((s) => s - 1)}>
              Back to the previous question
            </button>
          )}
        </fieldset>
      )}

      {result && (
        <section className="ss-finder__result" aria-live="polite">
          <div className="ss-finder__can">
            <Can flavour={result.best.flavour} title={result.best.flavour.name} />
          </div>
          <div>
            <p className="ss-hero__mile">Your stop is Mile {result.best.flavour.mile}</p>
            <h2>{result.best.flavour.name}</h2>
            <p className="ss-hero__line">{result.best.flavour.line}</p>
            <p>
              We picked it because {result.best.reasons.join(", and ")}.
            </p>
            <p className="ss-finder__runner">
              Close second: <a href={href(`${base}/shop/${result.runnerUp.flavour.id}`)}>{result.runnerUp.flavour.name}</a>.
            </p>
            <div className="ss-hero__buy">
              <button className="ss-btn" onClick={() => add({ product: result.best.flavour.id, format: "4", qty: 1 })}>
                Add a 4-pack — $9
              </button>
              <a className="ss-link" href={href(`${base}/shop/${result.best.flavour.id}`)}>
                See tasting notes
              </a>
              <button
                className="ss-link"
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
