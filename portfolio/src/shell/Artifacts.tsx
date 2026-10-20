import { Can } from "../projects/sailor/Can";
import { flavours } from "../projects/sailor/data";

/* Four objects inside the folder. Each hints at its world without borrowing the scrapbook's look. */

export function SailorArtifact() {
  return (
    <span className="art-sailor" aria-hidden="true">
      <span className="art-sailor__photo">
        <span className="art-sailor__sun" />
        <span className="art-sailor__shelf" />
        <Can flavour={flavours[1]} className="art-sailor__can art-sailor__can--back" />
        <Can flavour={flavours[0]} className="art-sailor__can art-sailor__can--front" />
        <Can flavour={flavours[2]} className="art-sailor__can art-sailor__can--right" />
      </span>
      <span className="art-sailor__swatches">
        {flavours.map((f) => (
          <i key={f.id} style={{ background: f.weather.label }} />
        ))}
      </span>
      <span className="art-tape art-tape--tl" />
    </span>
  );
}

export function LightleakArtifact() {
  return (
    <span className="art-ll" aria-hidden="true">
      <span className="art-ll__phone">
        <span className="art-ll__screen">
          <span className="art-ll__photo">
            <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="llsky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f6a66b" />
                  <stop offset=".55" stopColor="#f3c99a" />
                  <stop offset="1" stopColor="#6b84a8" />
                </linearGradient>
              </defs>
              <rect width="100" height="70" fill="url(#llsky)" />
              <circle cx="66" cy="34" r="9" fill="#fff1d6" />
              <rect y="44" width="100" height="26" fill="#3e5878" />
              <path d="M0 46 Q25 42 50 46 T100 45 V70 H0Z" fill="#2c4262" />
            </svg>
          </span>
          <span className="art-ll__palette">
            <i style={{ background: "#f6a66b" }} />
            <i style={{ background: "#f3c99a" }} />
            <i style={{ background: "#6b84a8" }} />
            <i style={{ background: "#2c4262" }} />
          </span>
          <span className="art-ll__mood">nostalgic, golden</span>
          <span className="art-ll__tracks">
            <b />
            <b />
            <b />
          </span>
        </span>
      </span>
      <span className="art-clip" />
    </span>
  );
}

export function RanchArtifact() {
  return (
    <span className="art-ranch" aria-hidden="true">
      <span className="art-ranch__half art-ranch__half--left">
        <svg viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice">
          <rect width="160" height="110" fill="#efc78f" />
          <circle cx="120" cy="40" r="16" fill="#f7e2b3" />
          <path d="M0 62 L30 40 L52 56 L80 30 L112 58 L140 44 L160 56 V110 H0Z" fill="#c6763f" />
          <path d="M0 76 L40 60 L70 72 L104 58 L160 74 V110 H0Z" fill="#a2472a" />
          <path d="M0 92 Q80 80 160 94 V110 H0Z" fill="#6c3a22" />
          <path d="M70 110 Q78 92 92 84" stroke="#efc78f" strokeWidth="3" fill="none" />
        </svg>
        <span className="art-ranch__greet">Greetings from</span>
        <span className="art-ranch__name">Copper Wells</span>
      </span>
      <span className="art-ranch__half art-ranch__half--right">
        <span className="art-ranch__stamp">
          <svg viewBox="0 0 30 36">
            <rect width="30" height="36" fill="#5e9c97" />
            <path d="M4 26 L12 16 L18 22 L26 12 V32 H4Z" fill="#efe2c8" />
          </svg>
        </span>
        <span className="art-ranch__postmark">VARA VALLEY</span>
        <span className="art-ranch__lines">
          <i />
          <i />
          <i />
        </span>
        <span className="art-ranch__writing">wish you were here — the sky goes on forever</span>
      </span>
    </span>
  );
}

export function MarginArtifact() {
  return (
    <span className="art-margin" aria-hidden="true">
      <span className="art-margin__book">
        <span className="art-margin__page art-margin__page--map">
          <svg viewBox="0 0 120 120">
            <rect width="120" height="120" fill="#e7efe9" />
            <path d="M0 80 Q30 70 50 90 T120 84 V120 H0Z" fill="#cfe3e8" />
            <path d="M20 20 L44 40 L70 34 L92 62 L60 86" stroke="#1f2a44" strokeWidth="2" strokeDasharray="4 3" fill="none" />
            {[
              [20, 20],
              [44, 40],
              [70, 34],
              [92, 62],
              [60, 86],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="4.5" fill={["#e8a33d", "#4f7a5a", "#c2577a", "#3d6fb6", "#e8a33d"][i]} stroke="#fff" strokeWidth="1.5" />
            ))}
          </svg>
        </span>
        <span className="art-margin__page art-margin__page--plan">
          <span className="art-margin__day">Day 2 · slow morning</span>
          <span className="art-margin__row"><i style={{ background: "#4f7a5a" }} />market walk</span>
          <span className="art-margin__row"><i style={{ background: "#c2577a" }} />tile museum</span>
          <span className="art-margin__row"><i style={{ background: "#3d6fb6" }} />sunset viewpoint</span>
          <span className="art-margin__budget">
            <b style={{ width: "62%" }} />
          </span>
          <span className="art-margin__sum">€412 of €650</span>
        </span>
      </span>
      <span className="art-margin__ticket">ADMIT · 2 · GATE B</span>
    </span>
  );
}
