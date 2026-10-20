/**
 * Demo "photos", painted in the browser with canvas: gradients, blurred light,
 * bokeh and film grain. They exist so the app can be tried without uploading
 * anything, and they're labelled as generated images in the interface.
 */
export interface DemoPhoto {
  id: string;
  title: string;
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 18, seed = 7) {
  const img = ctx.getImageData(0, 0, w, h);
  const r = rand(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.45) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export const demoPhotos: DemoPhoto[] = [
  {
    id: "beach",
    title: "Golden hour, last day of the trip",
    paint(ctx, w, h) {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.58);
      sky.addColorStop(0, "#6f86b3");
      sky.addColorStop(0.45, "#f0a77a");
      sky.addColorStop(1, "#ffd9a0");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      glow(ctx, w * 0.62, h * 0.52, w * 0.5, "rgba(255,236,190,.95)");
      ctx.fillStyle = "#fff4dc";
      ctx.beginPath();
      ctx.arc(w * 0.62, h * 0.54, w * 0.07, 0, Math.PI * 2);
      ctx.fill();
      const sea = ctx.createLinearGradient(0, h * 0.58, 0, h * 0.78);
      sea.addColorStop(0, "#c9876a");
      sea.addColorStop(1, "#3c4f72");
      ctx.fillStyle = sea;
      ctx.fillRect(0, h * 0.58, w, h * 0.22);
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = "#ffe2b0";
        const y = h * 0.6 + i * 4;
        ctx.fillRect(w * 0.62 - (60 - i) * 1.4, y, (60 - i) * 2.8 * (0.5 + (i % 3) * 0.3), 2);
      }
      ctx.globalAlpha = 1;
      const sand = ctx.createLinearGradient(0, h * 0.78, 0, h);
      sand.addColorStop(0, "#d7a77d");
      sand.addColorStop(1, "#8e6448");
      ctx.fillStyle = sand;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.8);
      ctx.quadraticCurveTo(w * 0.5, h * 0.76, w, h * 0.82);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();
      // two figures, silhouetted
      ctx.fillStyle = "#2b2230";
      [
        [0.3, 1],
        [0.36, 0.92],
      ].forEach(([x, s]) => {
        ctx.beginPath();
        ctx.arc(w * x, h * (0.72 - 0.05 * s), w * 0.018 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(w * x - w * 0.015 * s, h * (0.72 - 0.035 * s), w * 0.03 * s, h * 0.1 * s);
      });
      vignette(ctx, w, h, 0.35);
      grain(ctx, w, h, 22, 11);
    },
  },
  {
    id: "city",
    title: "Walking home after the rain",
    paint(ctx, w, h) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0d1426");
      bg.addColorStop(0.6, "#1a2140");
      bg.addColorStop(1, "#0a0d18");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const r = rand(42);
      ctx.save();
      ctx.filter = "blur(14px)";
      for (let i = 0; i < 46; i++) {
        const c = ["rgba(255,70,140,.55)", "rgba(40,220,210,.5)", "rgba(255,190,90,.5)", "rgba(140,120,255,.45)"][i % 4];
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(r() * w, r() * h * 0.62, 20 + r() * 60, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // wet street reflections
      for (let i = 0; i < 18; i++) {
        const x = r() * w;
        const g = ctx.createLinearGradient(0, h * 0.66, 0, h);
        const c = i % 2 ? "255,70,140" : "40,220,210";
        g.addColorStop(0, `rgba(${c},.45)`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, h * 0.66, 6 + r() * 16, h * 0.34);
      }
      ctx.fillStyle = "rgba(5,6,12,.85)";
      ctx.fillRect(0, h * 0.64, w, 6);
      // umbrella silhouette
      ctx.fillStyle = "#06070d";
      ctx.beginPath();
      ctx.arc(w * 0.52, h * 0.56, w * 0.12, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(w * 0.515, h * 0.56, w * 0.01, h * 0.12);
      ctx.fillRect(w * 0.49, h * 0.58, w * 0.06, h * 0.12);
      vignette(ctx, w, h, 0.6);
      grain(ctx, w, h, 26, 5);
    },
  },
  {
    id: "meadow",
    title: "Picnic, nobody checked the time",
    paint(ctx, w, h) {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      sky.addColorStop(0, "#7ec3ec");
      sky.addColorStop(1, "#d8f0f2");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.filter = "blur(18px)";
      ctx.fillStyle = "rgba(255,255,255,.9)";
      [
        [0.25, 0.14, 0.14],
        [0.38, 0.12, 0.1],
        [0.75, 0.2, 0.16],
      ].forEach(([x, y, s]) => {
        ctx.beginPath();
        ctx.ellipse(w * x, h * y, w * s, w * s * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      const field = ctx.createLinearGradient(0, h * 0.45, 0, h);
      field.addColorStop(0, "#9cc95a");
      field.addColorStop(1, "#4f8a2c");
      ctx.fillStyle = field;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.quadraticCurveTo(w * 0.4, h * 0.42, w, h * 0.5);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();
      const r = rand(3);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = ["#fff36b", "#ff7aa8", "#ffffff", "#ff9a3c"][i % 4];
        const y = h * 0.5 + r() * h * 0.5;
        ctx.beginPath();
        ctx.arc(r() * w, y, 2 + (y / h) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // picnic blanket
      ctx.save();
      ctx.translate(w * 0.5, h * 0.8);
      ctx.rotate(-0.2);
      for (let x = 0; x < 6; x++)
        for (let y = 0; y < 4; y++) {
          ctx.fillStyle = (x + y) % 2 ? "#e9474c" : "#fbeee6";
          ctx.fillRect(-w * 0.3 + x * w * 0.1, -h * 0.07 + y * h * 0.035, w * 0.1, h * 0.035);
        }
      ctx.restore();
      grain(ctx, w, h, 16, 9);
    },
  },
  {
    id: "window",
    title: "Sunday, curtains half open",
    paint(ctx, w, h) {
      ctx.fillStyle = "#e9dfe6";
      ctx.fillRect(0, 0, w, h);
      glow(ctx, w * 0.7, h * 0.25, w * 0.8, "rgba(255,240,226,1)");
      // window frame
      ctx.fillStyle = "rgba(255,252,248,.8)";
      ctx.fillRect(w * 0.45, h * 0.06, w * 0.48, h * 0.5);
      ctx.fillStyle = "rgba(200,180,200,.55)";
      ctx.fillRect(w * 0.68, h * 0.06, w * 0.02, h * 0.5);
      ctx.fillRect(w * 0.45, h * 0.3, w * 0.48, h * 0.015);
      // sheer curtain
      ctx.save();
      ctx.filter = "blur(6px)";
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? "rgba(236,200,214,.55)" : "rgba(250,230,236,.6)";
        ctx.fillRect(w * (0.38 + i * 0.025), 0, w * 0.03, h * 0.7);
      }
      ctx.restore();
      // light falling on a bed
      ctx.fillStyle = "#d9cbe0";
      ctx.fillRect(0, h * 0.62, w, h * 0.38);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#fff6e8";
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.62);
      ctx.lineTo(w * 0.85, h * 0.62);
      ctx.lineTo(w * 0.7, h);
      ctx.lineTo(w * 0.05, h);
      ctx.fill();
      ctx.restore();
      // mug
      ctx.fillStyle = "#b7a4c6";
      ctx.fillRect(w * 0.2, h * 0.7, w * 0.1, h * 0.09);
      ctx.strokeStyle = "#b7a4c6";
      ctx.lineWidth = w * 0.012;
      ctx.beginPath();
      ctx.arc(w * 0.31, h * 0.745, w * 0.025, -1.2, 1.2);
      ctx.stroke();
      grain(ctx, w, h, 12, 2);
    },
  },
];

const cache = new Map<string, string>();

/** Paints a demo photo once and returns it as a JPEG data URL. */
export function renderDemoPhoto(photo: DemoPhoto, w = 800, h = 1000): string {
  const key = `${photo.id}-${w}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  photo.paint(ctx, w, h);
  const url = canvas.toDataURL("image/jpeg", 0.88);
  cache.set(key, url);
  return url;
}
