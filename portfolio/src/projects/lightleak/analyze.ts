/**
 * Local image reading. Nothing leaves the browser: the photo is drawn to a
 * small canvas and we measure colour and light. The result is a creative
 * interpretation the user can edit — not a claim about how anyone feels.
 */
export const MOODS = [
  "dreamy",
  "nostalgic",
  "romantic",
  "melancholic",
  "playful",
  "cinematic",
  "peaceful",
  "energetic",
  "mysterious",
  "carefree",
] as const;
export type Mood = (typeof MOODS)[number];
export type MoodWeights = Record<Mood, number>;

export interface Swatch {
  hex: string;
  share: number; // fraction of pixels
  name: string;
}

export interface Analysis {
  palette: Swatch[];
  brightness: number; // 0–1
  saturation: number; // 0–1
  contrast: number; // 0–1
  warmth: number; // -1 cool … 1 warm
  hueSpread: number; // 0–1, how many different hues
  moods: MoodWeights;
  /** Plain-language notes on what was measured, shown to the user. */
  notes: string[];
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s, l };
}

export function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

export function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A friendly name for a colour, for playlist titles and captions. */
export function colourName(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  if (l < 0.13) return "midnight";
  if (l > 0.9) return "paper white";
  if (s < 0.12) return l < 0.45 ? "slate" : "silver";
  if (h < 15 || h >= 345) return l > 0.65 ? "rose" : "cherry";
  if (h < 40) return l > 0.65 ? "peach" : "amber";
  if (h < 60) return l > 0.6 ? "golden" : "ochre";
  if (h < 85) return "lemon";
  if (h < 150) return l > 0.55 ? "mint" : "moss";
  if (h < 190) return "sea-glass";
  if (h < 230) return l > 0.55 ? "sky" : "deep blue";
  if (h < 270) return "indigo";
  if (h < 310) return l > 0.6 ? "lilac" : "violet";
  return "pink";
}

/** Simple k-means on a pixel sample. Deterministic: seeds come from a brightness sort. */
function kmeans(pixels: number[][], k: number) {
  const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)].slice());
  let assign = new Array(pixels.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    assign = pixels.map((p) => {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    });
    centers = centers.map((c, i) => {
      const members = pixels.filter((_, j) => assign[j] === i);
      if (!members.length) return c;
      return [0, 1, 2].map((ch) => members.reduce((s, m) => s + m[ch], 0) / members.length);
    });
  }
  const counts = centers.map((_, i) => assign.filter((a) => a === i).length);
  return centers.map((c, i) => ({ c, n: counts[i] })).filter((x) => x.n > 0);
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function analyzePixels(data: Uint8ClampedArray | number[], width: number, height: number): Analysis {
  const pixels: number[][] = [];
  let lumSum = 0;
  let lumSq = 0;
  let satSum = 0;
  let warmSum = 0;
  const hueBins = new Array(12).fill(0);
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    lumSum += lum;
    lumSq += lum * lum;
    const { h, s } = rgbToHsl(r, g, b);
    satSum += s;
    warmSum += (r - b) / 255;
    if (s > 0.18) hueBins[Math.floor(h / 30) % 12]++;
    if (i % 2 === 0) pixels.push([r, g, b]);
  }
  const brightness = lumSum / total;
  const contrast = clamp(Math.sqrt(Math.max(0, lumSq / total - brightness * brightness)) * 3.2);
  const saturation = satSum / total;
  const warmth = Math.max(-1, Math.min(1, (warmSum / total) * 2.5));
  const usedBins = hueBins.filter((n) => n > total * 0.03).length;
  const hueSpread = clamp(usedBins / 6);

  const clusters = kmeans(pixels, 5).sort((a, b) => b.n - a.n);
  const palette: Swatch[] = clusters.map(({ c, n }) => {
    const hex = toHex(c[0], c[1], c[2]);
    return { hex, share: n / pixels.length, name: colourName(hex) };
  });

  const b = brightness;
  const s = saturation;
  const c = contrast;
  const w = (warmth + 1) / 2; // 0 cool … 1 warm
  const dark = 1 - b;
  const pinkish = hueBins[11] + hueBins[0] + hueBins[10];
  const greenBlue = hueBins[3] + hueBins[4] + hueBins[5] + hueBins[6] + hueBins[7];
  const pinkShare = clamp((pinkish / total) * 3);
  const natureShare = clamp((greenBlue / total) * 2);

  const moods: MoodWeights = {
    dreamy: clamp(b * 0.9 + (1 - c) * 0.6 + (0.5 - Math.abs(s - 0.35)) * 0.6 - 0.45),
    nostalgic: clamp(w * 0.8 + (1 - c) * 0.3 + (0.5 - Math.abs(s - 0.4)) * 0.5 - 0.2),
    romantic: clamp(pinkShare * 0.9 + w * 0.4 + (0.5 - Math.abs(b - 0.55)) * 0.5 - 0.15),
    melancholic: clamp((1 - s) * 0.7 + (1 - w) * 0.5 + dark * 0.4 - 0.55),
    playful: clamp(s * 0.9 + hueSpread * 0.7 + b * 0.3 - 0.45),
    cinematic: clamp(c * 1.0 + dark * 0.4 + Math.abs(warmth) * 0.3 - 0.35),
    peaceful: clamp((1 - c) * 0.7 + natureShare * 0.6 + (0.5 - Math.abs(b - 0.6)) * 0.4 - 0.3),
    energetic: clamp(s * 0.8 + c * 0.7 + b * 0.2 - 0.55),
    mysterious: clamp(dark * 1.1 + (1 - w) * 0.4 - 0.55),
    carefree: clamp(b * 0.7 + s * 0.5 + w * 0.4 - 0.55),
  };

  const notes: string[] = [];
  notes.push(b > 0.62 ? "Bright, airy exposure" : b < 0.35 ? "Low, shadowy light" : "Even, mid-tone light");
  notes.push(warmth > 0.15 ? "Warm colour cast" : warmth < -0.12 ? "Cool colour cast" : "Neutral colour balance");
  notes.push(c > 0.6 ? "Strong contrast" : c < 0.3 ? "Soft, low contrast" : "Moderate contrast");
  notes.push(s > 0.45 ? "Saturated colour" : s < 0.2 ? "Muted, almost monochrome" : "Gentle saturation");

  return { palette, brightness, saturation, contrast, warmth, hueSpread, moods, notes };
}

/** Draws an image element into a small canvas and analyses it. Browser only. */
export function analyzeImage(img: HTMLImageElement): Analysis {
  const size = 72;
  const canvas = document.createElement("canvas");
  const ratio = img.naturalWidth / img.naturalHeight || 1;
  canvas.width = ratio >= 1 ? size : Math.round(size * ratio);
  canvas.height = ratio >= 1 ? Math.round(size / ratio) : size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return analyzePixels(data, canvas.width, canvas.height);
}

export function topMoods(m: MoodWeights, n = 3): Mood[] {
  return [...MOODS].sort((a, b) => m[b] - m[a]).slice(0, n);
}
