import { MOODS, topMoods, type Analysis, type MoodWeights } from "./analyze";

export function emptyMoods(): MoodWeights {
  return Object.fromEntries(MOODS.map((m) => [m, 0])) as MoodWeights;
}

/** The starting mood selection for a freshly read photo: its top three readings. */
export function moodsFromAnalysis(a: Analysis): MoodWeights {
  const m = emptyMoods();
  topMoods(a.moods, 3).forEach((k, i) => (m[k] = Math.max(0.35, a.moods[k]) * (i === 0 ? 1 : 0.85)));
  return m;
}

/** A first guess at energy from saturation, contrast and brightness (0–100). */
export function energyFromAnalysis(a: Analysis): number {
  const guess = Math.round(30 + a.saturation * 60 + a.contrast * 25 - (1 - a.brightness) * 20);
  return Math.max(10, Math.min(90, guess));
}
