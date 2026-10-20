import { describe, expect, it } from "vitest";
import { analyzePixels, MOODS, type MoodWeights } from "./analyze";
import { defaultDirection, recommend } from "./recommend";

function solid(r: number, g: number, b: number, w = 20, h = 20) {
  const data: number[] = [];
  for (let i = 0; i < w * h; i++) data.push(r, g, b, 255);
  return data;
}

function weights(partial: Partial<MoodWeights>): MoodWeights {
  return Object.fromEntries(MOODS.map((m) => [m, partial[m] ?? 0])) as MoodWeights;
}

describe("image analysis", () => {
  it("reads a bright warm image as warm and bright", () => {
    const a = analyzePixels(solid(250, 200, 140), 20, 20);
    expect(a.brightness).toBeGreaterThan(0.7);
    expect(a.warmth).toBeGreaterThan(0.2);
    expect(a.palette[0].hex).toBe("#fac88c");
  });
  it("reads a dark cool image as mysterious rather than carefree", () => {
    const a = analyzePixels(solid(20, 30, 60), 20, 20);
    expect(a.moods.mysterious).toBeGreaterThan(a.moods.carefree);
  });
});

describe("demo recommendation engine", () => {
  it("returns different playlists for dreamy and energetic interpretations of the same photo", () => {
    const dreamy = recommend(weights({ dreamy: 1, peaceful: 0.6 }), { ...defaultDirection, energy: 20 }, "photo");
    const energetic = recommend(weights({ energetic: 1, playful: 0.6 }), { ...defaultDirection, energy: 85 }, "photo");
    const a = dreamy.tracks.map((t) => t.track.id);
    const b = energetic.tracks.map((t) => t.track.id);
    expect(a.filter((id) => b.includes(id)).length).toBeLessThan(2);
  });
  it("respects the explicit filter and instrumental preference", () => {
    const r = recommend(weights({ cinematic: 1 }), { ...defaultDirection, voice: "instrumental" }, "x");
    expect(r.tracks.every((t) => !t.track.vocal && !t.track.explicit)).toBe(true);
  });
  it("is deterministic for the same input", () => {
    const m = weights({ nostalgic: 0.8, romantic: 0.4 });
    expect(recommend(m, defaultDirection, "s").tracks.map((t) => t.track.id)).toEqual(
      recommend(m, defaultDirection, "s").tracks.map((t) => t.track.id),
    );
  });
});
