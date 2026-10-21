import { useEffect, useRef, useState } from "react";
import { MOODS, analyzeImage, colourName, topMoods, type Analysis, type Mood, type MoodWeights } from "./analyze";
import { genreLabels, type Genre, type Track } from "./catalog";
import { directionSummary, eraLabels, type Direction, type Era, type Scored, type Voice } from "./recommend";
import { demoPhotos, renderDemoPhoto } from "./demoPhotos";
import { Cover } from "./Cover";
import { playSketch, stopSketch } from "./sketch";
import { composePost, type PostFormat } from "./compose";
import type { Photo, SavedPlaylist, Step } from "./Lightleak";

interface Shared {
  photo: Photo | null;
  analysis: Analysis | null;
  palette: string[];
  moods: MoodWeights;
  setMoods: (m: MoodWeights) => void;
  direction: Direction;
  setDirection: (d: Direction) => void;
  setStep: (s: Step) => void;
}

const moodBlurbs: Record<Mood, string> = {
  dreamy: "soft focus, floating",
  nostalgic: "faded, remembered",
  romantic: "warm, close",
  melancholic: "blue, reflective",
  playful: "bright, bouncy",
  cinematic: "wide, dramatic",
  peaceful: "still, slow",
  energetic: "loud, moving",
  mysterious: "dark, after hours",
  carefree: "sunny, no plans",
};

/* ------------------------------------------------------------------ */
/* 2. Add a photo                                                      */
/* ------------------------------------------------------------------ */
export function PhotoStep({ photo, onChange, onNext }: { photo: Photo | null; onChange: (p: Photo | null, a: Analysis | null) => void; onNext: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const use = async (src: string, name: string, demo: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      onChange({ src, name, demo }, analyzeImage(img));
    } catch {
      setError("That file couldn't be read as an image. Try a JPEG, PNG or WebP.");
    } finally {
      setBusy(false);
    }
  };

  const fromFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(`“${file.name}” isn't an image. Choose a JPEG, PNG, WebP or HEIC photo.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("That photo is over 25 MB. Try a smaller copy.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => use(String(reader.result), file.name, false);
    reader.onerror = () => setError("The file couldn't be opened.");
    reader.readAsDataURL(file);
  };

  return (
    <section className="ll-screen ll-photo">
      <h2 className="ll-h">Add a photo</h2>
      <p className="ll-privacy">Your photo stays on this device. It's read in your browser — nothing is uploaded.</p>

      {photo ? (
        <figure className="ll-preview">
          <img src={photo.src} alt={photo.demo ? `Demo photo: ${photo.name}` : `Your photo: ${photo.name}`} />
          <figcaption>
            <span>{photo.demo ? `Demo image · ${photo.name}` : photo.name}</span>
            <span className="ll-preview__actions">
              <button className="ll-textbtn" onClick={() => input.current?.click()}>
                Replace
              </button>
              <button className="ll-textbtn" onClick={() => onChange(null, null)}>
                Remove
              </button>
            </span>
          </figcaption>
        </figure>
      ) : (
        <label
          htmlFor="ll-file"
          className={`ll-drop ${drag ? "is-drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            fromFile(e.dataTransfer.files[0]);
          }}
        >
          <span className="ll-drop__frame" aria-hidden="true" />
          <span className="ll-drop__title">{busy ? "Reading the light…" : "Choose a photo"}</span>
          <span className="ll-drop__sub">or drop it here · JPEG, PNG, WebP</span>
        </label>
      )}
      <input
        ref={input}
        id="ll-file"
        className="ll-file"
        type="file"
        accept="image/*"
        aria-label="Upload a photo from your device"
        onChange={(e) => {
          fromFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        onClick={(e) => e.stopPropagation()}
      />
      {!photo && (
        <button className="ll-btn ll-btn--ghost ll-upload" onClick={() => input.current?.click()}>
          Browse your photos
        </button>
      )}
      {error && (
        <p className="ll-error" role="alert">
          {error}
        </p>
      )}

      <div className="ll-demos">
        <p className="ll-label">No photo handy? Try one of ours</p>
        <div className="ll-demos__row">
          {demoPhotos.map((d) => (
            <button key={d.id} className={`ll-demo ${photo?.name === d.title ? "is-on" : ""}`} onClick={() => use(renderDemoPhoto(d), d.title, true)}>
              <img src={renderDemoPhoto(d, 160, 200)} alt="" />
              <span>{d.title}</span>
            </button>
          ))}
        </div>
        <p className="ll-fine">Demo images are painted in the browser for this prototype.</p>
      </div>

      <div className="ll-actions ll-actions--sticky">
        <button className="ll-btn" disabled={!photo || busy} onClick={onNext}>
          Read the mood
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Mood                                                             */
/* ------------------------------------------------------------------ */
function MoodChips({ moods, onChange, suggested }: { moods: MoodWeights; onChange: (m: MoodWeights) => void; suggested?: Mood[] }) {
  const toggle = (m: Mood) => {
    const next = { ...moods };
    next[m] = next[m] > 0.05 ? 0 : 0.8;
    onChange(next);
  };
  return (
    <div className="ll-moods" role="group" aria-label="Moods">
      {MOODS.map((m) => {
        const on = moods[m] > 0.05;
        return (
          <button key={m} className={`ll-mood ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggle(m)}>
            <span className="ll-mood__name">{m}</span>
            <span className="ll-mood__blurb">{moodBlurbs[m]}</span>
            {suggested?.includes(m) && <span className="ll-mood__tag">from the photo</span>}
          </button>
        );
      })}
    </div>
  );
}

export function MoodStep({ photo, analysis, palette, moods, setMoods, setStep }: Shared) {
  const suggested = analysis ? topMoods(analysis.moods, 3) : [];
  const active = MOODS.filter((m) => moods[m] > 0.05);
  return (
    <section className="ll-screen ll-moodstep">
      <div className="ll-read">
        {photo && <img className="ll-read__img" src={photo.src} alt="" />}
        <div className="ll-read__palette" aria-label="Colours sampled from the photo">
          {(analysis?.palette ?? palette.map((hex) => ({ hex, share: 0.2, name: colourName(hex) }))).map((s) => (
            <span key={s.hex} style={{ background: s.hex, flexGrow: Math.max(0.4, s.share * 10) }} title={`${s.name} ${s.hex}`}>
              <span className="sr-only">
                {s.name} {s.hex}
              </span>
            </span>
          ))}
        </div>
      </div>

      <h2 className="ll-h">Here's how it reads</h2>
      {analysis && (
        <ul className="ll-notes">
          {analysis.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="ll-copy">
        From the light and colour, this feels <strong>{suggested.join(", ") || "open to anything"}</strong>. That's a
        guess, not a fact — you know what the moment felt like. Change it.
      </p>

      <MoodChips moods={moods} onChange={setMoods} suggested={suggested} />
      <p className="ll-fine" aria-live="polite">
        {active.length === 0 ? "Pick at least one mood to continue." : `${active.length} selected`}
      </p>

      <div className="ll-actions ll-actions--sticky">
        <button className="ll-btn ll-btn--ghost" onClick={() => setStep("photo")}>
          Back
        </button>
        <button className="ll-btn" disabled={active.length === 0} onClick={() => setStep("direction")}>
          Choose a music direction
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Direction                                                        */
/* ------------------------------------------------------------------ */
function Slider({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="ll-slider">
      <span className="ll-label">{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(+e.target.value)} aria-valuetext={`${value} of 100, ${value < 50 ? low : high}`} />
      <span className="ll-slider__ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset className="ll-seg">
      <legend className="ll-label">{label}</legend>
      <div>
        {options.map(([v, l]) => (
          <label key={v} className={value === v ? "is-on" : ""}>
            <input type="radio" name={label} checked={value === v} onChange={() => onChange(v)} />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DirectionControls({ direction, setDirection, compact = false }: { direction: Direction; setDirection: (d: Direction) => void; compact?: boolean }) {
  const [more, setMore] = useState(!compact && direction.era !== "any");
  const toggleGenre = (g: Genre) =>
    setDirection({ ...direction, genres: direction.genres.includes(g) ? direction.genres.filter((x) => x !== g) : [...direction.genres, g] });
  return (
    <div className="ll-controls">
      <div>
        <p className="ll-label">Genres {direction.genres.length === 0 && <span className="ll-fine">— any, until you pick</span>}</p>
        <div className="ll-genres" role="group" aria-label="Genres">
          {(Object.keys(genreLabels) as Genre[]).map((g) => (
            <button key={g} className="ll-chip" aria-pressed={direction.genres.includes(g)} onClick={() => toggleGenre(g)}>
              {genreLabels[g]}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Energy" low="Slow" high="Loud" value={direction.energy} onChange={(v) => setDirection({ ...direction, energy: v })} />
      <Slider label="Familiar or new" low="Songs I know" high="Surprise me" value={direction.discovery} onChange={(v) => setDirection({ ...direction, discovery: v })} />
      <button className="ll-textbtn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
        {more ? "Fewer options" : "More options: era, vocals, explicit lyrics"}
      </button>
      {more && (
        <div className="ll-more">
          <Segmented<Era>
            label="Era"
            value={direction.era}
            options={(Object.keys(eraLabels) as Era[]).map((e) => [e, eraLabels[e]])}
            onChange={(v) => setDirection({ ...direction, era: v })}
          />
          <Segmented<Voice>
            label="Vocals"
            value={direction.voice}
            options={[
              ["any", "Either"],
              ["vocal", "With vocals"],
              ["instrumental", "Instrumental"],
            ]}
            onChange={(v) => setDirection({ ...direction, voice: v })}
          />
          <label className="ll-switch">
            <input type="checkbox" checked={direction.allowExplicit} onChange={(e) => setDirection({ ...direction, allowExplicit: e.target.checked })} />
            <span>Include songs with explicit lyrics</span>
          </label>
        </div>
      )}
    </div>
  );
}

export function DirectionStep({ moods, direction, setDirection, setStep, onGenerate }: Shared & { onGenerate: () => void }) {
  return (
    <section className="ll-screen ll-direction">
      <h2 className="ll-h">Choose a direction</h2>
      <p className="ll-copy">Three things matter most. Everything else is optional.</p>
      <DirectionControls direction={direction} setDirection={setDirection} />
      <p className="ll-summary">{directionSummary(moods, direction)}</p>
      <div className="ll-actions ll-actions--sticky">
        <button className="ll-btn ll-btn--ghost" onClick={() => setStep("mood")}>
          Back
        </button>
        <button className="ll-btn" onClick={onGenerate}>
          Make the playlist
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Signature transition: photo → sound                                 */
/* ------------------------------------------------------------------ */
export function Developing({ photo, palette, tracks, name, onDone }: { photo: Photo | null; palette: string[]; tracks: Track[]; name: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2900);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <section className="ll-develop" aria-label="Building your playlist">
      {photo && <img className="ll-develop__photo" src={photo.src} alt="" />}
      <div className="ll-develop__bands" aria-hidden="true">
        {palette.map((c, i) => (
          <i key={c} style={{ background: c, animationDelay: `${0.5 + i * 0.12}s` }} />
        ))}
      </div>
      <div className="ll-develop__tiles" aria-hidden="true">
        {tracks.slice(0, 8).map((t, i) => (
          <span key={t.id} style={{ animationDelay: `${1.3 + i * 0.08}s` }}>
            <Cover track={t} palette={palette} size={120} />
          </span>
        ))}
      </div>
      <p className="ll-develop__name">{name}</p>
      <p className="sr-only" role="status">
        Building your playlist
      </p>
      <button className="ll-develop__skip" onClick={onDone}>
        Skip
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5 + 6. Playlist, refine, pick the track                             */
/* ------------------------------------------------------------------ */
export function PlaylistStep(
  props: Shared & {
    name: string;
    onRename: (n: string) => void;
    tracks: Scored[];
    filteredOut: number;
    picks: string[];
    setPicks: (p: string[]) => void;
    chosen: string | null;
    setChosen: (id: string | null) => void;
    reopened: boolean;
    onRefineMoods: (m: MoodWeights) => void;
    onRefineDirection: (d: Direction) => void;
  },
) {
  const { photo, palette, moods, direction, name, onRename, tracks, filteredOut, picks, setPicks, chosen, setChosen, setStep } = props;
  const [playing, setPlaying] = useState<string | null>(null);
  const [refine, setRefine] = useState(false);
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState(0);
  const active = MOODS.filter((m) => moods[m] > 0.05);
  const chosenId = chosen ?? tracks[0]?.track.id;

  useEffect(() => () => stopSketch(), []);
  useEffect(() => setFlash((f) => f + 1), [tracks]);

  const toggleSketch = (t: Track) => {
    if (playing === t.id) {
      stopSketch();
      setPlaying(null);
      return;
    }
    const ok = playSketch(t, () => setPlaying((p) => (p === t.id ? null : p)));
    setPlaying(ok ? t.id : null);
  };

  return (
    <section className="ll-screen ll-playlist">
      <header className="ll-pl-head">
        {photo && <img className="ll-pl-head__img" src={photo.src} alt="" />}
        <div className="ll-pl-head__text">
          <p className="ll-label">Playlist for your photo</p>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setEditing(false);
              }}
            >
              <input className="ll-rename" defaultValue={name} autoFocus aria-label="Playlist name" onBlur={(e) => (onRename(e.target.value.trim() || name), setEditing(false))} onChange={(e) => onRename(e.target.value)} />
            </form>
          ) : (
            <h2 className="ll-pl-title">
              <button className="ll-pl-title__btn" onClick={() => setEditing(true)} aria-label={`Playlist name: ${name}. Rename`}>
                {name}
              </button>
            </h2>
          )}
          <div className="ll-pl-palette" aria-hidden="true">
            {palette.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
        </div>
      </header>
      <p className="ll-summary">{directionSummary(moods, direction)}</p>
      <ul className="ll-tags" aria-label="Mood labels">
        {active.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>

      <div className="ll-refine">
        <button className="ll-textbtn" aria-expanded={refine} onClick={() => setRefine((r) => !r)}>
          {refine ? "Done refining" : "Refine the feeling"}
        </button>
        {refine && (
          <div className="ll-refine__panel">
            <p className="ll-fine">Changes rebuild the list instantly.</p>
            <MoodChips moods={moods} onChange={(m) => MOODS.some((k) => m[k] > 0.05) && props.onRefineMoods(m)} />
            <DirectionControls direction={direction} setDirection={props.onRefineDirection} compact />
          </div>
        )}
      </div>

      <p className="ll-fine ll-pl-note">
        Tap a frame to mark songs that fit; choose one for your post. Covers are generated stand-ins and “mood sketch” plays a
        short synthesised loop in the song's key and tempo — not the song itself.
        {filteredOut > 0 && !direction.allowExplicit && ` ${filteredOut} explicit songs hidden.`}
      </p>

      {tracks.length === 0 ? (
        <div className="ll-empty">
          <p>Nothing in the demo catalogue matches every setting. Try “Any era” or switch vocals back to “Either”.</p>
          <button className="ll-btn ll-btn--ghost" onClick={() => props.onRefineDirection({ ...direction, era: "any", voice: "any", genres: [] })}>
            Loosen the filters
          </button>
        </div>
      ) : (
        <ol className="ll-sheet" key={flash}>
          {tracks.map(({ track, why }, i) => {
            const picked = picks.includes(track.id);
            const isChosen = chosenId === track.id;
            return (
              <li key={track.id} className={`ll-frame ${picked ? "is-picked" : ""} ${isChosen ? "is-chosen" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                <button
                  className="ll-frame__pick"
                  aria-pressed={picked}
                  onClick={() => setPicks(picked ? picks.filter((p) => p !== track.id) : [...picks, track.id])}
                  aria-label={`${picked ? "Unmark" : "Mark"} ${track.title} as a good fit`}
                >
                  <Cover track={track} palette={palette} size={140} />
                  <span className="ll-frame__circle" aria-hidden="true" />
                  <span className="ll-frame__num" aria-hidden="true">
                    {i + 1}A
                  </span>
                </button>
                <div className="ll-frame__meta">
                  <p className="ll-frame__title">{track.title}</p>
                  <p className="ll-frame__artist">
                    {track.artist} · {track.year}
                    {track.explicit && <abbr title="Explicit lyrics"> E</abbr>}
                  </p>
                  <p className="ll-frame__why">{why}</p>
                  <div className="ll-frame__actions">
                    <button className="ll-mini" onClick={() => toggleSketch(track)} aria-pressed={playing === track.id}>
                      {playing === track.id ? "Stop sketch" : "Mood sketch"}
                    </button>
                    <button className="ll-mini" aria-pressed={isChosen} onClick={() => setChosen(track.id)}>
                      {isChosen ? "For the post" : "Use for post"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="ll-actions ll-actions--sticky">
        <span className="ll-picked" aria-live="polite">
          {picks.length} marked
        </span>
        <button className="ll-btn" disabled={tracks.length === 0} onClick={() => (chosen || setChosen(chosenId), setStep("post"))}>
          Create the post
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Post preview                                                     */
/* ------------------------------------------------------------------ */
function captionIdeas(moods: MoodWeights, palette: string[], track: Track) {
  const top = topMoods(moods, 1)[0];
  const colour = palette[0] ? colourName(palette[0]) : "golden";
  return [
    `${colour} and ${top}, on repeat`,
    `soundtrack: ${track.title.toLowerCase()}`,
    `the ${top} part of the year`,
    `some days have a song. this one was ${track.title}`,
  ];
}

export function PostStep({
  photo,
  palette,
  moods,
  track,
  caption,
  setCaption,
  onSave,
  isSaved,
  setStep,
  name,
}: Shared & { track: Track; caption: string; setCaption: (c: string) => void; onSave: () => Promise<unknown>; isSaved: boolean; name: string }) {
  const [format, setFormat] = useState<PostFormat>("story");
  const [status, setStatus] = useState<string | null>(null);
  const ideas = captionIdeas(moods, palette, track);
  const text = caption || ideas[0];

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const copy = async () => {
    const details = `${track.title} — ${track.artist} (${track.year})`;
    try {
      await navigator.clipboard.writeText(details);
      setStatus(`Copied “${details}”`);
    } catch {
      setStatus(`Couldn't reach the clipboard. Track: ${details}`);
    }
  };

  const download = async () => {
    if (!photo) return;
    try {
      const url = await composePost({ photo: photo.src, track, caption: text, palette, format });
      const a = document.createElement("a");
      a.href = url;
      a.download = `lightleak-${format}.png`;
      a.click();
      setStatus("Image downloaded");
    } catch {
      setStatus("The image couldn't be created in this browser.");
    }
  };

  return (
    <section className="ll-screen ll-post">
      <h2 className="ll-h">Preview the post</h2>
      <div className="ll-seg ll-seg--inline" role="radiogroup" aria-label="Format">
        <div>
          {(
            [
              ["story", "Story 9:16"],
              ["square", "Post 1:1"],
            ] as [PostFormat, string][]
          ).map(([v, l]) => (
            <label key={v} className={format === v ? "is-on" : ""}>
              <input type="radio" name="format" checked={format === v} onChange={() => setFormat(v)} />
              {l}
            </label>
          ))}
        </div>
      </div>

      <div className={`ll-mock ll-mock--${format}`}>
        {photo && <img src={photo.src} alt="Your photo in the post preview" />}
        <div className="ll-mock__shade" />
        <p className="ll-mock__caption">{text}</p>
        <div className="ll-mock__sticker">
          <span className="ll-mock__art">
            <Cover track={track} palette={palette} size={44} />
          </span>
          <span>
            <strong>{track.title}</strong>
            <br />
            {track.artist}
          </span>
        </div>
      </div>
      <p className="ll-fine">Simulated preview. Lightleak doesn't post to any social network.</p>

      <label className="ll-field">
        <span className="ll-label">Caption</span>
        <textarea rows={2} maxLength={140} value={caption} placeholder={ideas[0]} onChange={(e) => setCaption(e.target.value)} />
      </label>
      <div className="ll-ideas" role="group" aria-label="Caption ideas">
        {ideas.map((i) => (
          <button key={i} className="ll-chip" onClick={() => setCaption(i)}>
            {i}
          </button>
        ))}
      </div>

      <div className="ll-post__actions">
        <button className="ll-btn ll-btn--ghost" onClick={copy}>
          Copy track details
        </button>
        <button className="ll-btn ll-btn--ghost" onClick={download}>
          Download image
        </button>
        <button
          className="ll-btn"
          onClick={async () => {
            await onSave();
            setStatus(isSaved ? `Updated “${name}”` : `Saved “${name}” on this device`);
          }}
        >
          {isSaved ? "Update saved playlist" : "Save playlist"}
        </button>
      </div>
      <p className="ll-status" role="status">
        {status}
      </p>
      <div className="ll-actions">
        <button className="ll-btn ll-btn--ghost" onClick={() => setStep("playlist")}>
          Back to the playlist
        </button>
        <button className="ll-textbtn" onClick={() => setStep("library")}>
          Go to saved playlists
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Saved playlists                                                  */
/* ------------------------------------------------------------------ */
export function Library({
  saved,
  onOpen,
  onRename,
  onRemove,
  onRestore,
  onNew,
}: {
  saved: SavedPlaylist[];
  onOpen: (p: SavedPlaylist) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onRestore: (p: SavedPlaylist) => void;
  onNew: () => void;
}) {
  const [removed, setRemoved] = useState<SavedPlaylist | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section className="ll-screen ll-library">
      <h2 className="ll-h">Saved playlists</h2>
      <p className="ll-fine">Kept in this browser only, with a small preview of each photo.</p>
      {removed && (
        <p className="ll-status" role="status">
          Removed “{removed.name}”.{" "}
          <button
            className="ll-textbtn"
            onClick={() => {
              onRestore(removed);
              setRemoved(null);
            }}
          >
            Undo
          </button>
        </p>
      )}
      {saved.length === 0 ? (
        <div className="ll-empty">
          <p>Nothing saved yet. Make a playlist from a photo and save it from the post screen.</p>
          <button className="ll-btn" onClick={onNew}>
            Start with a photo
          </button>
        </div>
      ) : (
        <ul className="ll-saved">
          {saved.map((p) => (
            <li key={p.id} className="ll-saved__item">
              <img src={p.thumb} alt="" />
              <div className="ll-saved__body">
                {editing === p.id ? (
                  <input
                    className="ll-rename ll-rename--small"
                    defaultValue={p.name}
                    autoFocus
                    aria-label="New playlist name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    onBlur={(e) => {
                      if (e.target.value.trim()) onRename(p.id, e.target.value.trim());
                      setEditing(null);
                    }}
                  />
                ) : (
                  <p className="ll-saved__name">{p.name}</p>
                )}
                <p className="ll-fine">
                  {p.trackIds.length} songs · {p.picks.length} marked · {new Date(p.createdAt).toLocaleDateString()}
                </p>
                <div className="ll-saved__palette" aria-hidden="true">
                  {p.palette.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </div>
                <div className="ll-frame__actions">
                  <button className="ll-mini" onClick={() => onOpen(p)}>
                    Open
                  </button>
                  <button className="ll-mini" onClick={() => setEditing(p.id)}>
                    Rename
                  </button>
                  <button
                    className="ll-mini"
                    onClick={() => {
                      setRemoved(p);
                      onRemove(p.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {saved.length > 0 && (
        <button className="ll-btn ll-btn--ghost" onClick={onNew}>
          New playlist from a photo
        </button>
      )}
    </section>
  );
}
