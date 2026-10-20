import { useRef } from "react";
import { owner } from "../content/owner";
import { projects } from "../content/projects";
import { useFocusTrap } from "../lib/useFocusTrap";

/** The recruiter's shortcut: everything important on one sheet, reachable from the top of the archive. */
export function QuickRead({ onClose, onOpen }: { onClose: () => void; onOpen: (path: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onClose);
  return (
    <div className="quickread-scrim" onClick={onClose}>
      <div
        className="quickread"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="quickread__close" onClick={onClose} data-autofocus>
          Close
        </button>
        <h2 id="qr-title">The 60-second version</h2>
        <p>
          <strong>{owner.name}</strong>, {owner.age}. {owner.role}. {owner.location}.
        </p>
        <p>{owner.availability}.</p>
        <h3>Four self-initiated concepts, four different skills</h3>
        <ol>
          {projects.map((p) => (
            <li key={p.id}>
              <strong>{p.title}</strong> — {p.skill}.{" "}
              <button className="linkish" onClick={() => onOpen(p.route)}>
                Open it
              </button>{" "}
              or{" "}
              <button className="linkish" onClick={() => onOpen(`/case/${p.id}`)}>
                read how it was made
              </button>
              .
            </li>
          ))}
        </ol>
        <h3>Tools</h3>
        <p>{owner.tools.join(", ")}.</p>
        <p className="quickread__contact">
          <a href={`mailto:${owner.email}`}>{owner.email}</a>
        </p>
      </div>
    </div>
  );
}
