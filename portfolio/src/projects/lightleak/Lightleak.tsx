import { useCallback, useEffect, useMemo, useState } from "react";
import "@fontsource/anton/400.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/800.css";
import { usePersistentState } from "../../lib/storage";
import { prefersReducedMotion } from "../../lib/motion";
import { MOODS, luminance, topMoods, type Analysis, type MoodWeights } from "./analyze";
import { catalog } from "./catalog";
import { defaultDirection, playlistName, recommend, type Direction } from "./recommend";
import { stopSketch } from "./sketch";
import { GrainDefs } from "./Cover";
import { Welcome, PhotoStep, MoodStep, DirectionStep, Developing, PlaylistStep, PostStep, Library } from "./screens";
import "./lightleak.css";

export type Step = "welcome" | "photo" | "mood" | "direction" | "developing" | "playlist" | "post" | "library";

export interface Photo {
  src: string;
  name: string;
  demo: boolean;
}

export interface SavedPlaylist {
  id: string;
  name: string;
  createdAt: number;
  thumb: string;
  palette: string[];
  moods: MoodWeights;
  direction: Direction;
  trackIds: string[];
  picks: string[];
  chosen: string | null;
  caption: string;
}

export const stepOrder: { id: Step; label: string }[] = [
  { id: "photo", label: "Photo" },
  { id: "mood", label: "Mood" },
  { id: "direction", label: "Direction" },
  { id: "playlist", label: "Playlist" },
  { id: "post", label: "Post" },
];

export function emptyMoods(): MoodWeights {
  return Object.fromEntries(MOODS.map((m) => [m, 0])) as MoodWeights;
}

/** Downscales the photo for local saving so a playlist doesn't fill storage. */
export async function thumbnail(src: string, max = 260): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * r);
  c.height = Math.round(img.naturalHeight * r);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.75);
}

export default function Lightleak({ path }: { path: string[] }) {
  const [step, setStep] = useState<Step>(path[0] === "library" ? "library" : "welcome");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [moods, setMoods] = useState<MoodWeights>(emptyMoods);
  const [direction, setDirection] = useState<Direction>(defaultDirection);
  const [picks, setPicks] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [saved, setSaved] = usePersistentState<SavedPlaylist[]>("ll.saved", []);
  const [reopened, setReopened] = useState<SavedPlaylist | null>(null);
  const [nameOverride, setNameOverride] = useState<string | null>(null);

  useEffect(() => () => stopSketch(), []);
  useEffect(() => {
    stopSketch();
    document.querySelector(".ll-app")?.scrollTo({ top: 0 });
  }, [step]);

  const palette = useMemo(() => (reopened ? reopened.palette : analysis?.palette.map((p) => p.hex) ?? []), [analysis, reopened]);
  const seed = photo?.name ?? "lightleak";

  const result = useMemo(() => {
    if (reopened && JSON.stringify(reopened.moods) === JSON.stringify(moods) && JSON.stringify(reopened.direction) === JSON.stringify(direction)) {
      const tracks = reopened.trackIds.map((id) => catalog.find((t) => t.id === id)).filter(Boolean);
      return { tracks: tracks.map((t) => ({ track: t!, score: 0, why: "saved pick" })), filteredOut: 0 };
    }
    return recommend(moods, direction, seed);
  }, [moods, direction, seed, reopened]);

  const name = nameOverride ?? (reopened?.name || (analysis ? playlistName(moods, analysis.palette, seed) : "Untitled"));

  const accent = palette[0] ?? "#c9c3b6";
  const accentInk = luminance(accent) > 0.55 ? "#151316" : "#fbfaf6";
  const style = {
    "--ll-a1": accent,
    "--ll-a2": palette[1] ?? "#8b8579",
    "--ll-a3": palette[2] ?? "#3f3b36",
    "--ll-on-a1": accentInk,
  } as React.CSSProperties;

  const choosePhoto = useCallback((p: Photo | null, a: Analysis | null) => {
    setPhoto(p);
    setAnalysis(a);
    setReopened(null);
    setNameOverride(null);
    setPicks([]);
    setChosen(null);
    if (a) {
      const top = topMoods(a.moods, 3);
      const m = emptyMoods();
      top.forEach((k, i) => (m[k] = Math.max(0.35, a.moods[k]) * (i === 0 ? 1 : 0.85)));
      setMoods(m);
      const energyGuess = Math.round(30 + a.saturation * 60 + a.contrast * 25 - (1 - a.brightness) * 20);
      setDirection((d) => ({ ...d, energy: Math.max(10, Math.min(90, energyGuess)) }));
    } else setMoods(emptyMoods());
  }, []);

  const developThenShow = () => {
    if (prefersReducedMotion()) setStep("playlist");
    else setStep("developing");
  };

  const save = async () => {
    if (!photo) return null;
    const thumb = reopened?.thumb ?? (await thumbnail(photo.src));
    const entry: SavedPlaylist = {
      id: reopened?.id ?? `${Date.now()}`,
      name,
      createdAt: reopened?.createdAt ?? Date.now(),
      thumb,
      palette,
      moods,
      direction,
      trackIds: result.tracks.map((t) => t.track.id),
      picks,
      chosen,
      caption,
    };
    setSaved((list) => [entry, ...list.filter((x) => x.id !== entry.id)]);
    setReopened(entry);
    return entry;
  };

  const reopen = (p: SavedPlaylist) => {
    setReopened(p);
    setPhoto({ src: p.thumb, name: p.id, demo: false });
    setAnalysis(null);
    setMoods(p.moods);
    setDirection(p.direction);
    setPicks(p.picks);
    setChosen(p.chosen);
    setCaption(p.caption);
    setNameOverride(null);
    setStep("playlist");
  };

  const shared = { photo, analysis, palette, moods, setMoods, direction, setDirection, setStep };

  let screen: React.ReactNode;
  switch (step) {
    case "welcome":
      screen = <Welcome onStart={() => setStep("photo")} savedCount={saved.length} onLibrary={() => setStep("library")} />;
      break;
    case "photo":
      screen = <PhotoStep photo={photo} onChange={choosePhoto} onNext={() => setStep("mood")} />;
      break;
    case "mood":
      screen = <MoodStep {...shared} />;
      break;
    case "direction":
      screen = <DirectionStep {...shared} onGenerate={developThenShow} />;
      break;
    case "developing":
      screen = <Developing photo={photo} palette={palette} tracks={result.tracks.map((t) => t.track)} name={name} onDone={() => setStep("playlist")} />;
      break;
    case "playlist":
      screen = (
        <PlaylistStep
          {...shared}
          name={name}
          onRename={setNameOverride}
          tracks={result.tracks}
          filteredOut={result.filteredOut}
          picks={picks}
          setPicks={setPicks}
          chosen={chosen}
          setChosen={setChosen}
          reopened={!!reopened}
          onRefineMoods={(m) => {
            setReopened(null);
            setMoods(m);
          }}
          onRefineDirection={(d) => {
            setReopened(null);
            setDirection(d);
          }}
        />
      );
      break;
    case "post":
      screen = (
        <PostStep
          {...shared}
          name={name}
          track={catalog.find((t) => t.id === (chosen ?? result.tracks[0]?.track.id)) ?? catalog[0]}
          caption={caption}
          setCaption={setCaption}
          onSave={save}
          isSaved={!!reopened && saved.some((s) => s.id === reopened.id)}
        />
      );
      break;
    case "library":
      screen = (
        <Library
          saved={saved}
          onOpen={reopen}
          onRename={(id, n) => setSaved((list) => list.map((x) => (x.id === id ? { ...x, name: n } : x)))}
          onRemove={(id) => setSaved((list) => list.filter((x) => x.id !== id))}
          onRestore={(p) => setSaved((list) => [p, ...list])}
          onNew={() => {
            choosePhoto(null, null);
            setStep("photo");
          }}
        />
      );
      break;
  }

  const current = stepOrder.findIndex((s) => s.id === (step === "developing" ? "playlist" : step));
  const mood = topMoods(moods, 1)[0];

  return (
    <div className={`ll ll--${step} ll-mood--${mood}`} style={style}>
      <GrainDefs />
      <aside className="ll-rail">
        <p className="ll-rail__brand">
          Lightleak<sup>concept</sup>
        </p>
        <p className="ll-rail__q">What does this picture sound like?</p>
        <ol className="ll-strip" aria-label="Steps">
          {stepOrder.map((s, i) => {
            const reachable = (s.id === "photo") || (s.id === "mood" && !!analysis) || (s.id === "direction" && !!analysis) || ((s.id === "playlist" || s.id === "post") && (!!analysis || !!reopened));
            return (
              <li key={s.id} className={i === current ? "is-now" : i < current ? "is-done" : ""}>
                <button disabled={!reachable} onClick={() => setStep(s.id)} aria-current={i === current ? "step" : undefined}>
                  <span className="ll-strip__n">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button className="ll-rail__lib" onClick={() => setStep("library")}>
          Saved playlists ({saved.length})
        </button>
        <p className="ll-rail__honest">
          Prototype. Photos are read in your browser and never uploaded. Recommendations come from a small hand-tagged demo
          catalogue — not an AI model or a streaming service.
        </p>
      </aside>
      <div className="ll-app" aria-live="off">
        {screen}
      </div>
    </div>
  );
}
