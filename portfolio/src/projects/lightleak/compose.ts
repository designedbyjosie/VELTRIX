import type { Track } from "./catalog";

export type PostFormat = "story" | "square";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * r;
  const ih = img.naturalHeight * r;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Renders the post preview to a PNG the user can download. Runs entirely in the browser. */
export async function composePost(opts: {
  photo: string;
  track: Track;
  caption: string;
  palette: string[];
  format: PostFormat;
}): Promise<string> {
  const { photo, track, caption, palette, format } = opts;
  const w = 1080;
  const h = format === "story" ? 1920 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(photo);
  cover(ctx, img, w, h);
  const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.65)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // music sticker
  const sx = 72;
  const sy = format === "story" ? h - 420 : h - 250;
  ctx.fillStyle = "rgba(255,255,255,.94)";
  ctx.beginPath();
  ctx.roundRect(sx, sy, w - sx * 2, 150, 28);
  ctx.fill();
  palette.slice(0, 4).forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(sx + 28 + (i % 2) * 47, sy + 28 + Math.floor(i / 2) * 47, 47, 47);
  });
  ctx.fillStyle = "#151316";
  ctx.font = "64px Anton, Impact, sans-serif";
  ctx.fillText(track.title.toUpperCase().slice(0, 22), sx + 150, sy + 86);
  ctx.font = "600 32px Manrope, system-ui, sans-serif";
  ctx.fillText(track.artist, sx + 150, sy + 126);

  ctx.fillStyle = "#fff";
  ctx.font = "600 44px Manrope, system-ui, sans-serif";
  const lines = wrapText(ctx, caption, w - sx * 2).slice(0, format === "story" ? 3 : 2);
  lines.forEach((line, i) => ctx.fillText(line, sx, sy - 44 - (lines.length - 1 - i) * 58));

  ctx.font = "26px Manrope, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.fillText("made with Lightleak (concept)", sx, h - 48);
  return canvas.toDataURL("image/png");
}
