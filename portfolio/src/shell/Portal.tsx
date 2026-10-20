import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { navigate } from "../lib/router";
import { prefersReducedMotion, wait } from "../lib/motion";

interface LaunchOptions {
  /** The element the visitor chose; the portal grows out of its exact position. */
  from: HTMLElement;
  to: string;
  color: string;
  label: string;
}

type Launch = (opts: LaunchOptions) => void;

const PortalContext = createContext<Launch>(({ to }) => navigate(to));

export function usePortal() {
  return useContext(PortalContext);
}

interface Frame {
  rect: DOMRect;
  color: string;
  label: string;
  stage: "start" | "grow" | "fade";
}

/**
 * The artifact-to-product transition: a sheet the colour of the destination
 * grows out of the clicked artifact until it fills the window, the route
 * changes underneath it, then it lifts away to reveal the product.
 */
export function PortalProvider({ children }: { children: ReactNode }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const busy = useRef(false);

  const launch = useCallback<Launch>(async ({ from, to, color, label }) => {
    if (busy.current) return;
    if (prefersReducedMotion()) {
      navigate(to);
      return;
    }
    busy.current = true;
    const rect = from.getBoundingClientRect();
    setFrame({ rect, color, label, stage: "start" });
    await wait(30);
    setFrame((f) => f && { ...f, stage: "grow" });
    await wait(720);
    navigate(to);
    await wait(260);
    setFrame((f) => f && { ...f, stage: "fade" });
    await wait(420);
    setFrame(null);
    busy.current = false;
  }, []);

  let style: React.CSSProperties | undefined;
  if (frame) {
    const { rect } = frame;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clip =
      frame.stage === "start"
        ? `inset(${rect.top}px ${vw - rect.right}px ${vh - rect.bottom}px ${rect.left}px round 6px)`
        : "inset(0px 0px 0px 0px round 0px)";
    style = { background: frame.color, clipPath: clip, opacity: frame.stage === "fade" ? 0 : 1 };
  }

  return (
    <PortalContext.Provider value={launch}>
      {children}
      {frame && (
        <div className={`portal portal--${frame.stage}`} style={style} aria-hidden="true">
          <span className="portal__label">{frame.label}</span>
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {frame ? `Opening ${frame.label}` : ""}
      </div>
    </PortalContext.Provider>
  );
}
