import { useCallback, useEffect, useRef, useState } from "react";
import { navigate } from "../lib/router";
import { prefersReducedMotion, wait } from "../lib/motion";
import { owner } from "../content/owner";
import { Archive } from "./Archive";
import { FolderCover } from "./FolderCover";
import "./folder.css";

type Phase = "closed" | "opening" | "open" | "closing";

/**
 * The entrance. A closed folder sits on the desk; opening it swings the cover
 * on a real hinge, lets the papers inside react, then lifts the inner sheet
 * out until it becomes the full archive. Closing plays it backwards.
 */
export function FolderStage({ openOnLoad }: { openOnLoad: boolean }) {
  const [phase, setPhase] = useState<Phase>(openOnLoad ? "open" : "closed");
  const [sheetRect, setSheetRect] = useState<DOMRect | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Keep phase in sync with the back button (#/archive <-> #/).
  useEffect(() => {
    if (openOnLoad && (phase === "closed" || phase === "closing")) setPhase("open");
    if (!openOnLoad && phase === "open") setPhase("closed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnLoad]);

  const open = useCallback(
    async (instant = false) => {
      if (phase !== "closed") return;
      if (instant || prefersReducedMotion()) {
        setSheetRect(null);
        setPhase("open");
        navigate("/archive");
        return;
      }
      setPhase("opening");
      await wait(1250);
      setSheetRect(sheetRef.current?.getBoundingClientRect() ?? null);
      setPhase("open");
      navigate("/archive");
    },
    [phase],
  );

  const close = useCallback(async () => {
    setPhase("closing");
    navigate("/", { replace: false });
  }, []);

  // After a close, the cover swings shut on the next frame.
  useEffect(() => {
    if (phase !== "closing") return;
    const t = setTimeout(() => setPhase("closed"), prefersReducedMotion() ? 0 : 60);
    return () => clearTimeout(t);
  }, [phase]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const r = folderRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - (r.left + r.width / 2)) / r.width;
    const y = (e.clientY - (r.top + r.height / 2)) / r.height;
    setTilt({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  };

  if (phase === "open") {
    return <Archive entranceFrom={sheetRect} onClose={close} />;
  }

  return (
    <main className="pf pf-stage" onPointerMove={onPointerMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
      <a className="pf-skip" href="#/archive" onClick={(e) => (e.preventDefault(), open(true))}>
        Skip the intro and go straight to the work
      </a>
      <header className="pf-stage__top">
        <span className="pf-stage__who">{owner.name}</span>
        <span className="pf-stage__what">{owner.role}</span>
      </header>

      <div className="pf-stage__scene">
        <div
          ref={folderRef}
          className={`folder folder--${phase}`}
          style={{ "--tx": tilt.x, "--ty": tilt.y } as React.CSSProperties}
        >
          {/* back board + tab */}
          <div className="folder__back" aria-hidden="true">
            <div className="folder__tab" />
          </div>
          {/* the papers inside, which flutter as the cover lifts */}
          <div className="folder__inside" aria-hidden="true">
            <div className="inside-sheet inside-sheet--3" />
            <div className="inside-sheet inside-sheet--2" />
            <div className="inside-sheet inside-sheet--1" ref={sheetRef}>
              <span className="inside-sheet__script">four worlds</span>
              <span className="inside-sheet__pixel">archive</span>
              <div className="inside-thumbs">
                <i style={{ background: "#173f73" }} />
                <i style={{ background: "#1d1b20" }} />
                <i style={{ background: "#a2472a" }} />
                <i style={{ background: "#e8a33d" }} />
              </div>
            </div>
            <div className="inside-clip" />
            <div className="inside-ticket">admit one</div>
          </div>
          {/* the cover, hinged on its left edge */}
          <button
            className="folder__cover"
            onClick={() => open()}
            aria-label={`Open ${owner.name}'s portfolio folder`}
            disabled={phase !== "closed"}
          >
            <span className="folder__cover-front">
              <FolderCover />
            </span>
            <span className="folder__cover-inner" aria-hidden="true">
              <span className="cover-inner__note">
                if found, please return to the internet
                <br />— {owner.signature}
              </span>
            </span>
          </button>
        </div>
        <p className="pf-stage__hint" aria-hidden="true">
          {phase === "closed" ? "tap the folder to open it" : " "}
        </p>
      </div>
    </main>
  );
}
