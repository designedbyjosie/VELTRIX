import type { ProjectId } from "../content/projects";
import type { ObjectId } from "./content";

/** Top-down illustrations of each object, built from separate shapes so each can move on its own. */
export function ObjectArt({ id, drawerOpen, clipped, linked }: { id: ObjectId; drawerOpen: boolean; clipped: boolean; linked?: ProjectId }) {
  switch (id) {
    case "laptop":
      return (
        <span className="oa oa-laptop">
          <span className="oa-laptop__screen">
            <span className="oa-laptop__ui">
              <i />
              <i />
              <i />
            </span>
            <span className="oa-laptop__sticker" />
          </span>
          <span className="oa-laptop__base">
            <span className="oa-laptop__keys" />
            <span className="oa-laptop__pad" />
          </span>
        </span>
      );
    case "sketchbook":
      return (
        <span className="oa oa-book">
          <span className="oa-book__page oa-book__page--l">
            <svg viewBox="0 0 100 130">
              <rect x="12" y="14" width="76" height="30" fill="none" stroke="#5f5463" strokeWidth="1.5" />
              <path d="M12 14 L88 44 M88 14 L12 44" stroke="#cfc8d4" />
              <rect x="12" y="52" width="34" height="34" fill="none" stroke="#5f5463" strokeWidth="1.5" />
              <rect x="54" y="52" width="34" height="34" fill="none" stroke="#5f5463" strokeWidth="1.5" />
              <path d="M12 98 h60 M12 106 h48 M12 114 h70" stroke="#b9a6cf" strokeWidth="2" />
            </svg>
          </span>
          <span className="oa-book__page oa-book__page--r">
            <svg viewBox="0 0 100 130">
              <text x="12" y="34" fontFamily="Pinyon Script, cursive" fontSize="26" fill="#2e2433">
                Aa
              </text>
              <circle cx="70" cy="28" r="14" fill="#ecc9c7" />
              <path d="M14 60 C30 50 50 76 86 58" stroke="#5f5463" strokeWidth="1.5" fill="none" />
              <path d="M14 80 h70 M14 90 h56 M14 100 h64" stroke="#d6cfc2" strokeWidth="2" />
            </svg>
          </span>
          <span className="oa-book__ribbon" />
        </span>
      );
    case "moodboard":
      return (
        <span className="oa oa-mood">
          {["#a2472a", "#f8dc6c", "#1f2a44", "#b9a6cf", "#5e9c97", "#ecc9c7"].map((c, i) => (
            <i key={c} style={{ background: c, transform: `rotate(${(i % 2 ? 1 : -1) * (3 + i)}deg)` }} />
          ))}
          <b className="oa-mood__pin" />
        </span>
      );
    case "pinboard":
      return (
        <span className="oa oa-pin">
          <svg viewBox="0 0 100 80" className="oa-pin__strings">
            <path d="M25 24 L72 22 L74 56 L28 58 Z M25 24 L74 56" fill="none" stroke="#a2472a" strokeWidth="1" />
          </svg>
          <i className={`oa-pin__card oa-pin__card--sailor ${linked === "sailor" ? "is-hot" : ""}`} />
          <i className={`oa-pin__card oa-pin__card--lightleak ${linked === "lightleak" ? "is-hot" : ""}`} />
          <i className={`oa-pin__card oa-pin__card--ranch ${linked === "ranch" ? "is-hot" : ""}`} />
          <i className={`oa-pin__card oa-pin__card--margin ${linked === "margin" ? "is-hot" : ""}`} />
        </span>
      );
    case "letter":
      return (
        <span className="oa oa-letter">
          <span className="oa-letter__lines">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="oa-letter__sig">hello —</span>
          {clipped && <span className="oa-letter__clip" />}
        </span>
      );
    case "headphones":
      return (
        <span className="oa oa-phones">
          <span className="oa-phones__band" />
          <span className="oa-phones__cup oa-phones__cup--l" />
          <span className="oa-phones__cup oa-phones__cup--r" />
          <span className="oa-phones__cable" />
        </span>
      );
    case "photos":
      return (
        <span className="oa oa-photos">
          <i style={{ background: "linear-gradient(#9dc3c1,#e07a5f)" }} />
          <i style={{ background: "linear-gradient(#6d597a,#eaac8b)" }} />
          <i style={{ background: "linear-gradient(#264653,#e9c46a)" }} />
        </span>
      );
    case "envelope":
      return (
        <span className="oa oa-env">
          <span className="oa-env__flap" />
          <span className="oa-env__seal" />
        </span>
      );
    case "drawer":
      return (
        <span className={`oa oa-drawer ${drawerOpen ? "is-open" : ""}`}>
          <span className="oa-drawer__box">
            <i />
            <i />
            <i />
          </span>
          <span className="oa-drawer__front">
            <span className="oa-drawer__handle" />
          </span>
        </span>
      );
    case "notes":
    default:
      return (
        <span className="oa oa-notes">
          <i style={{ background: "#f4e7a1" }} />
          <i style={{ background: "#e4d7f2" }} />
          <i style={{ background: "#d7e3d6" }} />
        </span>
      );
  }
}
