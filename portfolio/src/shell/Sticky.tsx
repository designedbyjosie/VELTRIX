import { useState } from "react";

/** A sticky note stuck to an artifact. Flip it to read the design decision behind the project. */
export function Sticky({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      className={`sticky ${flipped ? "is-flipped" : ""}`}
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      aria-label={flipped ? `Design note: ${back}. Flip back.` : `Flip note: ${front}`}
    >
      <span className="sticky__inner">
        <span className="sticky__face sticky__front">{front}</span>
        <span className="sticky__face sticky__back">{back}</span>
      </span>
    </button>
  );
}
