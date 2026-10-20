import { owner } from "../content/owner";

/** The front of the folder — a direct descendant of the reference collage. */
export function FolderCover() {
  return (
    <span className="cover">
      <span className="cover__note">
        <span className="cover__note-lines" />
      </span>
      <span className="cover__tape" />
      <svg className="cover__pin" viewBox="0 0 60 80" aria-hidden="true">
        <defs>
          <radialGradient id="pinHead" cx="35%" cy="30%" r="70%">
            <stop offset="0" stopColor="#f3e6ff" />
            <stop offset=".45" stopColor="#c6a3e3" />
            <stop offset="1" stopColor="#7d5aa3" />
          </radialGradient>
        </defs>
        <ellipse cx="30" cy="70" rx="14" ry="4" fill="rgba(60,30,60,.25)" />
        <path d="M28 40 L22 72 L30 44Z" fill="#9b9aa3" />
        <ellipse cx="30" cy="38" rx="13" ry="7" fill="#9a77bd" />
        <rect x="22" y="18" width="16" height="20" rx="5" fill="url(#pinHead)" />
        <ellipse cx="30" cy="16" rx="17" ry="9" fill="url(#pinHead)" />
      </svg>
      <span className="cover__title">
        <span className="cover__port">Port</span>
        <span className="cover__folio">folio</span>
      </span>
      <svg className="cover__star" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f5f3f7" />
            <stop offset=".35" stopColor="#8d8794" />
            <stop offset=".55" stopColor="#e9e5ee" />
            <stop offset="1" stopColor="#4b4552" />
          </linearGradient>
        </defs>
        <path
          d="M50 4 L62 36 L96 38 L69 59 L79 93 L50 73 L21 93 L31 59 L4 38 L38 36Z"
          fill="url(#chrome)"
          stroke="#3b3540"
          strokeWidth="2"
        />
      </svg>
      <span className="cover__seal" aria-hidden="true">
        <svg viewBox="0 0 40 40">
          <path d="M14 26c-4-4 0-12 6-8 6-4 10 4 6 8-2 2-4 4-6 6-2-2-4-4-6-6z" fill="none" stroke="#7a5d99" strokeWidth="2" />
        </svg>
      </span>
      <span className="cover__label">{owner.name}</span>
      <span className="cover__scribble">four self-initiated concepts inside</span>
    </span>
  );
}
