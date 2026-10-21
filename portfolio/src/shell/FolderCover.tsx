import { owner } from "../content/owner";

/**
 * The front board of the portfolio folder: rose bookcloth, rose-gold foil,
 * a debossed name plate and brushed corner protectors. Purely decorative —
 * the button that wraps it carries the accessible name.
 */
export function FolderCover() {
  return (
    <span className="cover" aria-hidden="true">
      <span className="cover__frame" />
      <span className="cover__eyebrow">Vol. 01 — Four worlds</span>
      <span className="cover__title">
        <span className="cover__foil">Portfolio</span>
      </span>
      <span className="cover__rule" />
      <span className="cover__plate">
        <span className="cover__plate-name">{owner.name}</span>
        <span className="cover__plate-role">{owner.role}</span>
      </span>
      <span className="cover__foot">
        <span>Four self-initiated concepts</span>
        <span>{new Date().getFullYear()}</span>
      </span>
      <span className="cover__corner cover__corner--top" />
      <span className="cover__corner cover__corner--bottom" />
    </span>
  );
}
