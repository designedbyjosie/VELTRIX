/**
 * Makes the 1600×1200 cover image for each concept (public/img/covers).
 *
 *   npm run dev                       # in one terminal
 *   node tools/render-covers.mjs      # in another (needs the `playwright` package)
 *   node tools/render-covers.mjs ranch desk   # only some covers
 *
 * - Lightleak, Margin and Copper Wells: the live hero of each concept, captured
 *   after its entrance animations settle.
 * - Sailor Springs: a crop of the rendered hero photograph.
 * - The desk: the desk render with every object layered on top, as the site does.
 * Run tools/render-assets.mjs first if the Sailor or desk renders have changed.
 */
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.SITE_URL ?? "http://127.0.0.1:5173/";
const W = 1600;
const H = 1200;
const heroes = { lightleak: "#/work/lightleak", margin: "#/work/margin", ranch: "#/work/copper-wells" };
const all = [...Object.keys(heroes), "sailor", "desk"];
const want = process.argv.slice(2).length ? process.argv.slice(2) : all;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("  page error:", e.message));

/** Draws an image (data URL or site path) into a W×H canvas, cropping to fill, and returns WebP bytes. */
async function toWebp(src, crop) {
  const url = await page.evaluate(
    async ({ src, crop, W, H }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const [sx, sy, sw, sh] = crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      return c.toDataURL("image/webp", 0.82);
    },
    { src, crop, W, H },
  );
  return Buffer.from(url.split(",")[1], "base64");
}

async function save(id, bytes) {
  await writeFile(join(root, "public/img/covers", `${id}.webp`), bytes);
  console.log(`✓ covers/${id}.webp`);
}

for (const id of want) {
  if (heroes[id]) {
    await page.goto(base + heroes[id]);
    await page.waitForTimeout(3000);
    await page.screenshot(); // headless Chromium only advances CSS animations when a frame is forced
    await page.waitForTimeout(4000);
    await page.addStyleTag({ content: ".exit-tab{display:none!important}" });
    await page.waitForTimeout(500);
    const png = await page.screenshot();
    await save(id, await toWebp(`data:image/png;base64,${png.toString("base64")}`));
  } else if (id === "sailor") {
    await page.goto(base);
    // the hero render is 2400×1500; take the centred 4:3 crop
    await save(id, await toWebp("/img/sailor/hero.webp", [200, 0, 2000, 1500]));
  } else if (id === "desk") {
    await page.goto(base);
    const layout = JSON.parse(await readFile(join(root, "src/desk/layout.json"), "utf8"));
    const url = await page.evaluate(async (layout) => {
      const load = async (src) => {
        const i = new Image();
        i.src = src;
        await i.decode();
        return i;
      };
      const { width, height } = layout.frame;
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const g = c.getContext("2d");
      g.drawImage(await load("/img/desk/base.webp"), 0, 0);
      const items = Object.entries(layout.objects)
        .filter(([k]) => k !== "drawer-open")
        .sort((a, b) => a[1].bbox.y + a[1].bbox.h - (b[1].bbox.y + b[1].bbox.h));
      for (const [k, v] of items) g.drawImage(await load(`/img/desk/${k}.webp`), (v.bbox.x / 100) * width, (v.bbox.y / 100) * height);
      return c.toDataURL("image/png");
    }, layout);
    await save(id, await toWebp(url, [200, 0, 2000, 1500]));
  }
}
await browser.close();
