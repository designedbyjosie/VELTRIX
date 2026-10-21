import { useRef, useState } from "react";
import { href } from "../../lib/router";
import { useScrollProgress } from "../../lib/scroll";
import { base } from "./SailorSprings";

/** The end of the road: the sun sets as you reach the bottom of the page. */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, "through");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "error" | "done">("idle");
  return (
    <footer className="ss-foot" ref={ref}>
      <div className="ss-foot__sky" aria-hidden="true">
        <span className="ss-foot__sun" style={{ transform: `translate(-50%, ${Math.max(0, (p - 0.2) * 140)}%)` }} />
        <span className="ss-foot__sea" />
      </div>
      <div className="ss-foot__grid">
        <div>
          <p className="ss-foot__title">Postcards from the road</p>
          <p>A letter when a new flavour reaches the spring. Nothing else.</p>
          {state === "done" ? (
            <p className="ss-foot__ok" role="status">
              Thanks — this is a concept site, so your address wasn't stored or sent anywhere.
            </p>
          ) : (
            <form
              className="ss-foot__form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setState(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "done" : "error");
              }}
            >
              <label className="sr-only" htmlFor="ss-news">
                Email address
              </label>
              <input id="ss-news" type="email" placeholder="you@example.com" value={email} onChange={(e) => (setEmail(e.target.value), setState("idle"))} aria-invalid={state === "error"} aria-describedby={state === "error" ? "ss-news-err" : undefined} />
              <button type="submit">Subscribe</button>
              {state === "error" && (
                <span id="ss-news-err" className="ss-foot__err">
                  Enter an email like you@example.com.
                </span>
              )}
            </form>
          )}
        </div>
        <nav aria-label="Footer">
          <a href={href(`${base}/shop`)}>Shop</a>
          <a href={href(`${base}/story`)}>The road</a>
          <a href={href(`${base}/finder`)}>Find your mile</a>
          <a href={href(base)}>Home</a>
        </nav>
        <p className="ss-foot__honest">
          Sailor Springs is a fictional brand designed as a self-initiated portfolio concept. Nothing is for sale; checkout is switched off and no orders or
          payments are processed.
        </p>
      </div>
      <p className="ss-foot__word" aria-hidden="true">
        Sailor Springs
      </p>
    </footer>
  );
}
