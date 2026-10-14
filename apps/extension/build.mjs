/**
 * Builds the extension into dist/.
 *   VELTRIX_API_URL  backend origin (default http://localhost:3000); becomes the only host permission.
 *   --watch          rebuild on change
 */
import { build, context } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
const apiUrl = new URL(process.env.VELTRIX_API_URL ?? "http://localhost:3000").origin;
const watch = process.argv.includes("--watch");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common = {
  bundle: true,
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  target: "chrome116",
  define: { __VELTRIX_API_URL__: JSON.stringify(apiUrl), "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  logLevel: "info",
  legalComments: "none",
};

const configs = [
  { ...common, entryPoints: [join(root, "src/background.ts")], outfile: join(out, "background.js"), format: "esm" },
  // The extractor's completion value (last expression) is what chrome.scripting.executeScript returns.
  { ...common, entryPoints: [join(root, "src/extractor.ts")], outfile: join(out, "extractor.js"), format: "iife", globalName: "__veltrixExtractor", footer: { js: "__veltrixExtractor.run();" } },
  { ...common, entryPoints: { popup: join(root, "src/popup/main.tsx"), options: join(root, "src/options/main.tsx") }, outdir: out, format: "iife", jsx: "automatic", loader: { ".css": "css" } },
];

if (watch) {
  for (const c of configs) await (await context(c)).watch();
} else {
  await Promise.all(configs.map((c) => build(c)));
}

cpSync(join(root, "static"), out, { recursive: true, filter: (src) => !src.endsWith("manifest.template.json") });
const manifest = readFileSync(join(root, "static/manifest.template.json"), "utf8").replace("__API_ORIGIN__", apiUrl);
writeFileSync(join(out, "manifest.json"), manifest);
console.log(`VELTRIX extension built for ${apiUrl} → ${out}`);
