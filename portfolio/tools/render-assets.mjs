/**
 * Bakes the site's image assets from the three.js scenes in src/render.
 *
 *   npm run dev                      # in one terminal
 *   node tools/render-assets.mjs     # in another (needs the `playwright` package)
 *   node tools/render-assets.mjs sailor-hero desk   # only matching jobs
 *
 * Outputs WebP files into public/img and layout data into src/.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.RENDER_URL ?? "http://127.0.0.1:5173/render.html";
const flavours = ["low-tide", "lighthouse-lemon", "night-swim", "fog-line", "postcard-peach", "spring-source"];

const jobs = [
  "sailor-hero",
  "sailor-lineup",
  "sailor-ice",
  "sailor-box",
  ...flavours.map((f) => `sailor-portrait&flavour=${f}`),
  ...flavours.map((f) => `sailor-cutout&flavour=${f}`),
  ...(process.env.EXTRA_JOBS ? process.env.EXTRA_JOBS.split(",") : []),
];

const filter = process.argv.slice(2);
const todo = filter.length ? jobs.filter((j) => filter.some((f) => j.startsWith(f))) : jobs;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("pageerror", (e) => console.error("  page error:", e.message));
for (const job of todo) {
  const t0 = Date.now();
  await page.goto(`${base}?scene=${job}`);
  await page.waitForFunction(() => window.__render?.done, null, { timeout: 600_000, polling: 500 });
  const res = await page.evaluate(() => window.__render);
  if (res.error) {
    console.error(`✗ ${job}\n${res.error}`);
    continue;
  }
  for (const o of res.outputs) {
    const target = o.file.endsWith(".json") ? join(root, o.file) : join(root, "public/img", o.file);
    await mkdir(dirname(target), { recursive: true });
    if (o.dataUrl) await writeFile(target, Buffer.from(o.dataUrl.split(",")[1], "base64"));
    else await writeFile(target, JSON.stringify(o.meta, null, 2) + "\n");
    console.log(`✓ ${o.file}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}
await browser.close();
