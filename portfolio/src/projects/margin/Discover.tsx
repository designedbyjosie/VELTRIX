import { href } from "../../lib/router";
import { interestColours, interestLabels, type Interest } from "./data";
import { effectiveDays, money, rankDestinations, type TripInput } from "./engine";
import { base } from "./Margin";

export function Discover({ input, onChoose }: { input: TripInput; setInput: (i: TripInput) => void; onChoose: (id: string) => void }) {
  const ranked = rankDestinations(input);
  const days = effectiveDays(input);
  return (
    <section className="mg-discover">
      <header className="mg-discover__head">
        <h1>Trips that fit</h1>
        <p className="mg-lede">
          {days} days, {input.travelers} {input.travelers === 1 ? "person" : "people"}, {money(input.budget)}
          {input.budgetIncludesTravel ? " including travel" : " plus travel"}. Ranked by how well each place matches what you enjoy, the season,
          the journey and the money. <a href={href(`${base}/plan`)}>Change answers</a>
        </p>
      </header>
      {ranked.length === 0 ? (
        <p className="mg-empty">No sample destinations match “{input.scope}” from your starting point. Try “Either” in the first step.</p>
      ) : (
        <ol className="mg-options">
          {ranked.map((r, i) => (
            <li key={r.dest.id} className={`mg-option ${i === 0 ? "is-best" : ""} ${r.fits ? "" : "is-over"}`}>
              <div className="mg-option__band" style={{ background: `linear-gradient(90deg, ${r.dest.palette[0]}, ${r.dest.palette[1]})` }} aria-hidden="true" />
              <div className="mg-option__body">
                <p className="mg-option__rank">{i === 0 ? "Best fit" : `Option ${i + 1}`}</p>
                <h2>{r.dest.name}</h2>
                <p className="mg-option__blurb">
                  {r.dest.country} · {r.dest.blurb}
                </p>
                <ul className="mg-option__why">
                  {r.reasons.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <ul className="mg-option__tags" aria-label="Good for">
                  {(Object.entries(r.dest.interests) as [Interest, number][])
                    .filter(([, v]) => v >= 0.85)
                    .map(([k]) => (
                      <li key={k} style={{ borderColor: interestColours[k], color: interestColours[k] }}>
                        {interestLabels[k]}
                      </li>
                    ))}
                </ul>
              </div>
              <div className="mg-option__money">
                <p>
                  <span>From</span>
                  <strong>{money(r.minimum)}</strong>
                </p>
                <p>
                  <span>Typical for you</span>
                  <strong>{money(r.estimate)}</strong>
                </p>
                <span className={`mg-badge mg-badge--${r.fits ? (r.estimate <= input.budget ? "fits" : "tight") : "over"}`}>{r.fits ? (r.estimate <= input.budget ? "Fits" : "Fits if you're careful") : "Over budget"}</span>
                <button className="mg-btn" onClick={() => onChoose(r.dest.id)}>
                  Build this trip
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mg-fine">All figures are estimates from Margin's sample data, not live prices.</p>
    </section>
  );
}
