import { useEffect, useRef } from "react";
import { locations, type LocationId } from "./data";
import { RanchScene, type TimeOfDay } from "./scene3d";

interface Props {
  time: TimeOfDay;
  arrived: boolean;
  riding: boolean;
  onArrive: () => void;
  onOpen: (id: LocationId) => void;
  rideRequest: number;
  skipRequest: number;
  resetRequest: number;
  onFail: () => void;
}

/** The WebGL landscape plus an accessible layer of HTML buttons that track 3D positions. */
export function Scene3D({ time, arrived, onArrive, onOpen, rideRequest, skipRequest, resetRequest, onFail }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RanchScene | null>(null);
  const markers = useRef(new Map<LocationId, HTMLElement>());
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;

  useEffect(() => {
    const canvas = canvasRef.current!;
    let scene: RanchScene;
    try {
      scene = new RanchScene(canvas, { time, arrived });
    } catch {
      onFail();
      return;
    }
    sceneRef.current = scene;
    markers.current.forEach((el, id) => scene.registerMarker(id, el));
    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);
    const onVis = () => scene.setRunning(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => scene.setRunning(e.isIntersecting && !document.hidden));
    io.observe(canvas);
    canvas.addEventListener("webglcontextlost", onFail);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
      canvas.removeEventListener("webglcontextlost", onFail);
      scene.dispose();
      sceneRef.current = null;
    };
    // the scene is built once; later changes go through the methods below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => sceneRef.current?.setTime(time), [time]);
  useEffect(() => {
    if (rideRequest) sceneRef.current?.rideIn(() => onArriveRef.current());
  }, [rideRequest]);
  useEffect(() => {
    if (skipRequest) sceneRef.current?.skipRide();
  }, [skipRequest]);
  useEffect(() => {
    if (resetRequest) sceneRef.current?.resetToGate();
  }, [resetRequest]);

  return (
    <div
      className="cw-scene"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        sceneRef.current?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      }}
    >
      <canvas ref={canvasRef} className="cw-scene__canvas" aria-hidden="true" />
      <div className="cw-markers">
        {locations.map((l) => (
          <button
            key={l.id}
            ref={(el) => {
              if (el) markers.current.set(l.id, el);
              else markers.current.delete(l.id);
              sceneRef.current?.registerMarker(l.id, el);
            }}
            className="cw-marker"
            data-visible="false"
            onClick={() => onOpen(l.id)}
            tabIndex={arrived ? 0 : -1}
            aria-hidden={!arrived}
          >
            <span className="cw-marker__pin" aria-hidden="true" />
            <span className="cw-marker__label">{l.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The non-WebGL landscape: layered SVG planes with gentle parallax and the
 * same places to explore. Used when WebGL is missing, for reduced motion, or by choice.
 */
export function FlatLandscape({ time, arrived, onOpen }: { time: TimeOfDay; arrived: boolean; onOpen: (id: LocationId) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const sky: Record<TimeOfDay, [string, string, string]> = {
    dawn: ["#6f7fb0", "#f2b28a", "#ffc79a"],
    day: ["#4f93c4", "#f1dcb4", "#fff1d6"],
    dusk: ["#3b3a73", "#f07a4a", "#ff8a4c"],
    night: ["#070b1f", "#24305a", "#dfe6ff"],
  };
  const [top, horizon, sun] = sky[time];
  const dark = time === "night";
  return (
    <div
      className={`cw-flat ${arrived ? "is-arrived" : ""}`}
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty("--fx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      }}
    >
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="cwsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset=".75" stopColor={horizon} />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#cwsky)" />
        {dark &&
          Array.from({ length: 80 }, (_, i) => <circle key={i} cx={(i * 397) % 1600} cy={(i * 131) % 420} r={(i % 3) * 0.6 + 0.6} fill="#fff" opacity=".8" />)}
        <circle cx={time === "day" ? 1150 : 380} cy={time === "day" ? 200 : 470} r="70" fill={sun} />
        <g className="cw-flat__far">
          <path d="M0 520 L120 520 L150 430 L330 430 L360 520 L700 520 L730 460 L900 460 L930 520 L1250 520 L1290 400 L1500 400 L1540 520 L1600 520 V900 H0Z" fill={dark ? "#2a2238" : "#b85d34"} opacity=".75" />
        </g>
        <g className="cw-flat__mid">
          <path d="M0 600 Q300 560 600 590 T1200 580 T1600 600 V900 H0Z" fill={dark ? "#3a2a2a" : "#c98e3b"} />
        </g>
        <g className="cw-flat__near">
          <path d="M0 690 Q400 650 800 680 T1600 670 V900 H0Z" fill={dark ? "#2b1d18" : "#a2472a"} />
          <path d="M760 900 C780 820 720 760 820 700 S900 640 880 610" stroke={dark ? "#5a4a3a" : "#e8c897"} strokeWidth="38" fill="none" />
          {/* ranch house */}
          <g transform="translate(760 560)">
            <rect width="170" height="60" fill="#c98e66" />
            <rect x="-6" y="-10" width="182" height="12" fill="#b57a55" />
            {[20, 70, 120].map((x) => (
              <rect key={x} x={x} y="20" width="18" height="22" fill={dark || time === "dusk" ? "#ffb45a" : "#2b1d14"} />
            ))}
          </g>
          {/* windmill */}
          <g transform="translate(560 470)" stroke="#3b2418" strokeWidth="4" fill="none">
            <path d="M10 140 L30 0 L50 140" />
            <circle cx="30" cy="0" r="30" strokeDasharray="6 4" />
          </g>
          {dark && <circle cx="900" cy="700" r="30" fill="#ff9a3c" opacity=".5" />}
        </g>
      </svg>
      {arrived && (
        <div className="cw-flat__markers">
          {/* positions mirror the illustrated map */}
          {[
            ["gate", 50, 92],
            ["house", 53, 58],
            ["stables", 66, 62],
            ["trail", 82, 50],
            ["windmill", 37, 52],
            ["campfire", 57, 76],
            ["overlook", 18, 42],
            ["store", 28, 70],
          ].map(([id, x, y]) => {
            const l = locations.find((loc) => loc.id === id)!;
            return (
              <button key={id} className="cw-marker" data-visible="true" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -100%)" }} onClick={() => onOpen(l.id)}>
                <span className="cw-marker__pin" aria-hidden="true" />
                <span className="cw-marker__label">{l.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
