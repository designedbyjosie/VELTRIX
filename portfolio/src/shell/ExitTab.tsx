import { useState } from "react";
import { href } from "../lib/router";
import { projects } from "../content/projects";

/**
 * The one piece of the portfolio that follows you into every world: a paper
 * tab on the left edge. Small enough not to compete with each product's own
 * navigation, always there to get back to the folder.
 */
export function ExitTab({ project }: { project?: string }) {
  const [open, setOpen] = useState(false);
  const meta = projects.find((p) => p.route.endsWith(project ?? "-"));
  return (
    <nav
      className={`exit-tab ${open ? "is-open" : ""}`}
      aria-label="Portfolio"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="exit-tab__handle"
        aria-expanded={open}
        aria-controls="exit-tab-links"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Folder</span>
      </button>
      <div className="exit-tab__links" id="exit-tab-links" hidden={!open}>
        <p className="exit-tab__note">
          {meta ? `${meta.title} is a self-initiated concept.` : "A self-initiated concept."}
        </p>
        <a href={href("/archive")}>Back to the folder</a>
        {meta && <a href={href(`/case/${meta.id}`)}>Read the case study</a>}
        <a href={href("/desk")}>Visit the desk</a>
      </div>
    </nav>
  );
}
