// @vitest-environment node
import { describe, expect, it, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import type { PageExtraction } from "@veltrix/shared";

const dist = join(__dirname, "..", "dist");

beforeAll(() => {
  execSync("node build.mjs", { cwd: join(__dirname, ".."), stdio: "ignore" });
});

function runBundle(html: string, url: string, options?: { includeArticleExcerpt: boolean }) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  if (options) dom.window.eval(`globalThis.__veltrixOptions = ${JSON.stringify(options)}`);
  return dom.window.eval(readFileSync(join(dist, "extractor.js"), "utf8")) as PageExtraction;
}

describe("built extractor bundle", () => {
  it("returns a product extraction as the script's completion value", () => {
    const ld = JSON.stringify({ "@type": "Product", name: "Kindle Paperwhite", offers: { price: "149.99", priceCurrency: "USD" } });
    const r = runBundle(`<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`, "https://www.example-store.com/kindle");
    expect(r.pageType).toBe("product");
    expect(r.product!.priceCents).toBe(14999);
  });

  it("consumes and clears injected options", () => {
    const dom = new JSDOM(`<html><head><meta property="og:type" content="article"><meta property="og:title" content="Rates"></head><body><article><p>Body.</p></article></body></html>`, { url: "https://news.example.com/x", runScripts: "outside-only" });
    dom.window.eval(`globalThis.__veltrixOptions = {"includeArticleExcerpt": true}`);
    const r = dom.window.eval(readFileSync(join(dist, "extractor.js"), "utf8")) as PageExtraction;
    expect(r.article!.excerpt).toBe("Body.");
    expect(dom.window.eval("globalThis.__veltrixOptions")).toBeUndefined();
    // Next run without options: no excerpt.
    expect((dom.window.eval(readFileSync(join(dist, "extractor.js"), "utf8")) as PageExtraction).article!.excerpt).toBeNull();
  });

  it("declares least-privilege permissions", () => {
    const m = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
    expect(m.manifest_version).toBe(3);
    expect(m.permissions.sort()).toEqual(["activeTab", "scripting", "storage"]);
    expect(m.host_permissions).toEqual(["http://localhost:3000/*"]);
    expect(m.content_scripts).toBeUndefined();
    expect(m.externally_connectable).toBeUndefined();
    expect(m.web_accessible_resources).toBeUndefined();
  });
});
