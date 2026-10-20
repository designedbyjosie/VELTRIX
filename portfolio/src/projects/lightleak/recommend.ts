import { MOODS, colourName, type Mood, type MoodWeights, type Swatch } from "./analyze";
import { catalog, genreLabels, type Genre, type Track } from "./catalog";

export type Era = "any" | "classic" | "80s90s" | "2000s" | "2010s" | "now";
export type Voice = "any" | "vocal" | "instrumental";

export interface Direction {
  genres: Genre[]; // empty = any
  energy: number; // 0–100
  era: Era;
  discovery: number; // 0 = only songs people know … 100 = mostly lesser-known
  voice: Voice;
  allowExplicit: boolean;
}

export const defaultDirection: Direction = {
  genres: [],
  energy: 50,
  era: "any",
  discovery: 35,
  voice: "any",
  allowExplicit: false,
};

export const eraLabels: Record<Era, string> = {
  any: "Any era",
  classic: "Before 1980",
  "80s90s": "80s & 90s",
  "2000s": "2000s",
  "2010s": "2010s",
  now: "2020s",
};

function inEra(year: number, era: Era) {
  switch (era) {
    case "classic":
      return year < 1980;
    case "80s90s":
      return year >= 1980 && year < 2000;
    case "2000s":
      return year >= 2000 && year < 2010;
    case "2010s":
      return year >= 2010 && year < 2020;
    case "now":
      return year >= 2020;
    default:
      return true;
  }
}

export interface Scored {
  track: Track;
  score: number;
  why: string;
}

/** Small deterministic hash so the same photo always gets the same tie-breaks. */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * The demo recommendation engine. Rule-based and transparent:
 * mood overlap carries most weight, then energy, genre and discovery.
 * Voice, era and explicit preferences are hard filters.
 */
export function recommend(moods: MoodWeights, dir: Direction, seed = "", count = 8): { tracks: Scored[]; filteredOut: number } {
  const active = MOODS.filter((m) => moods[m] > 0.05);
  let filteredOut = 0;
  const scored: Scored[] = [];
  for (const track of catalog) {
    if (!dir.allowExplicit && track.explicit) {
      filteredOut++;
      continue;
    }
    if (dir.voice === "vocal" && !track.vocal) continue;
    if (dir.voice === "instrumental" && track.vocal) continue;
    if (!inEra(track.year, dir.era)) continue;

    const moodScore = track.moods.reduce((s, m, i) => s + moods[m] * (i === 0 ? 1.3 : 1), 0);
    const energyScore = 1 - Math.abs(track.energy - dir.energy / 100);
    const genreScore = dir.genres.length === 0 ? 0.5 : dir.genres.includes(track.genre) ? 1 : 0;
    const d = dir.discovery / 100;
    const discoveryScore = 1 - Math.abs(1 - track.popularity - d);
    const jitter = hash(seed + track.id) * 0.08;
    const score = moodScore * 2.2 + energyScore * 1.4 + genreScore * 1.5 + discoveryScore * 0.8 + jitter;

    const matched = track.moods.filter((m) => active.includes(m)).sort((a, b) => moods[b] - moods[a]);
    const parts: string[] = [];
    if (matched.length) parts.push(matched.slice(0, 2).join(" + "));
    if (energyScore > 0.85) parts.push(track.energy > 0.65 ? "matches your high energy" : track.energy < 0.35 ? "as slow as you asked" : "right energy");
    if (dir.genres.includes(track.genre)) parts.push(genreLabels[track.genre].toLowerCase());
    if (track.popularity < 0.5 && d > 0.5) parts.push("lesser-known pick");
    scored.push({ track, score, why: parts.join(" · ") || "a wildcard that fits the light" });
  }
  scored.sort((a, b) => b.score - a.score);
  // Avoid one artist dominating the list.
  const out: Scored[] = [];
  const perArtist = new Map<string, number>();
  for (const s of scored) {
    const n = perArtist.get(s.track.artist) ?? 0;
    if (n >= 1 && out.length < count) continue;
    perArtist.set(s.track.artist, n + 1);
    out.push(s);
    if (out.length >= count) break;
  }
  return { tracks: out, filteredOut };
}

const moodPhrases: Record<Mood, string[]> = {
  dreamy: ["Half asleep in", "Soft focus,", "Floating through"],
  nostalgic: ["Summers we kept in", "Rewinding", "Faded"],
  romantic: ["Slow dance in", "Love letters in", "Holding hands in"],
  melancholic: ["Rain on", "Blue hours in", "Missing"],
  playful: ["Cartwheels in", "Pocketful of", "Silly in"],
  cinematic: ["Opening credits,", "Wide shot of", "Final scene in"],
  peaceful: ["Quiet morning in", "Breathing in", "Still water,"],
  energetic: ["Windows down,", "Full volume", "Running through"],
  mysterious: ["After dark in", "Streetlights and", "Somewhere in"],
  carefree: ["No plans,", "Sun on", "Barefoot in"],
};

export function playlistName(moods: MoodWeights, palette: Swatch[], seed: string) {
  const top = [...MOODS].sort((a, b) => moods[b] - moods[a])[0];
  const options = moodPhrases[top];
  const phrase = options[Math.floor(hash(seed + top) * options.length)];
  const colour = palette[0] ? colourName(palette[0].hex) : "colour";
  return `${phrase} ${colour}`;
}

export function directionSummary(moods: MoodWeights, dir: Direction) {
  const top = [...MOODS].sort((a, b) => moods[b] - moods[a]).filter((m) => moods[m] > 0.05).slice(0, 3);
  const energy = dir.energy < 35 ? "slow" : dir.energy > 65 ? "high-energy" : "mid-tempo";
  const genres = dir.genres.length ? dir.genres.map((g) => genreLabels[g].toLowerCase()).join(", ") : "any genre";
  const disc = dir.discovery > 60 ? "leaning toward lesser-known songs" : dir.discovery < 25 ? "sticking to songs people know" : "a mix of familiar and new";
  return `A ${energy}, ${top.join(" and ") || "open"} selection — ${genres}, ${eraLabels[dir.era].toLowerCase()}, ${disc}.`;
}
