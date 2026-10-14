// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { extractPage } from "../src/extract";
import { canonicalizeUrl, cleanText, safeUrl } from "../src/sanitize";
import { pageExtractionSchema } from "../src/schemas";

function doc(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

const productLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Sony WH-1000XM5 Wireless Headphones",
  image: ["https://cdn.example.com/xm5.jpg"],
  brand: { "@type": "Brand", name: "Sony" },
  sku: "WH1000XM5/B",
  gtin13: "4548736132610",
  offers: { "@type": "Offer", price: "348.00", priceCurrency: "USD", availability: "https://schema.org/InStock" },
});

describe("extractPage — shopping", () => {
  it("reads JSON-LD Product data", () => {
    const d = doc(`<html><head><title>Headphones</title><meta property="og:site_name" content="Example Store"><script type="application/ld+json">${productLd}</script></head><body></body></html>`);
    const r = extractPage(d, "https://shop.example.com/p/xm5?utm_source=x&color=black#reviews");
    expect(r.pageType).toBe("product");
    expect(r.product).toMatchObject({ title: "Sony WH-1000XM5 Wireless Headphones", priceCents: 34800, currency: "USD", merchant: "Example Store", brand: "Sony", gtin: "4548736132610", availability: "InStock" });
    expect(r.canonicalUrl).toBe("https://shop.example.com/p/xm5?color=black");
    expect(() => pageExtractionSchema.parse(r)).not.toThrow();
  });
  it("reads Amazon-style display markup", () => {
    const d = doc(`<html><head><title>Amazon.com</title></head><body><span id="productTitle">  Sony WH-1000XM5  </span><div class="a-price"><span class="a-offscreen">$348.00</span></div><img id="landingImage" src="https://m.media-amazon.com/x.jpg"></body></html>`);
    const r = extractPage(d, "https://www.amazon.com/dp/B09XS7JWHH");
    expect(r.pageType).toBe("product");
    expect(r.product?.priceCents).toBe(34800);
    expect(r.product?.merchant).toBe("Amazon");
    expect(r.domain).toBe("amazon.com");
  });
  it("never reads form control values", () => {
    const d = doc(`<html><head><meta property="og:type" content="product"><meta property="og:title" content="Gift card"></head><body><input itemprop="price" value="999.99"><input type="password" value="hunter2"></body></html>`);
    const r = extractPage(d, "https://shop.example.com/gift");
    expect(JSON.stringify(r)).not.toContain("999.99");
    expect(JSON.stringify(r)).not.toContain("hunter2");
  });
  it("refuses checkout, login and banking pages", () => {
    const d = doc(`<html><head><script type="application/ld+json">${productLd}</script></head></html>`);
    expect(extractPage(d, "https://shop.example.com/checkout/payment").unsupportedReason).toBe("sensitive");
    expect(extractPage(d, "https://www.chase.com/anything").unsupportedReason).toBe("sensitive");
    expect(extractPage(d, "https://shop.example.com/account/orders").pageType).toBe("unsupported");
  });
  it("ignores malformed JSON-LD and does not execute scripts", () => {
    (globalThis as Record<string, unknown>).__pwned = false;
    const d = doc(`<html><head><script type="application/ld+json">{ "@type": "Product", bad json</script><script>globalThis.__pwned = true</script></head></html>`);
    const r = extractPage(d, "https://example.org/");
    expect(r.pageType).toBe("unsupported");
    expect((globalThis as Record<string, unknown>).__pwned).toBe(false);
  });
});

describe("extractPage — finance", () => {
  it("detects a quote page from its URL", () => {
    const r = extractPage(doc("<html><head><title>NVIDIA (NVDA)</title></head></html>"), "https://finance.yahoo.com/quote/NVDA/");
    expect(r.pageType).toBe("instrument");
    expect(r.symbols).toContain("NVDA");
  });
  it("detects articles and explicit ticker mentions, skipping common words", () => {
    const ld = JSON.stringify({ "@type": "NewsArticle", headline: "Chipmakers rally as AI demand grows", datePublished: "2026-10-13T12:00:00Z", publisher: { "@type": "Organization", name: "Example News" } });
    const d = doc(`<html><head><script type="application/ld+json">${ld}</script><meta name="description" content="Shares of Nvidia (NASDAQ: NVDA) and $AMD rose. The CEO said $US demand..."></head><body><article><p>Paragraph one.</p></article></body></html>`);
    const r = extractPage(d, "https://news.example.com/markets/chips");
    expect(r.pageType).toBe("article");
    expect(r.article?.publisher).toBe("Example News");
    expect(r.article?.excerpt).toBeNull();
    expect(r.symbols.sort()).toEqual(["AMD", "NVDA"]);
  });
  it("only includes an excerpt when explicitly allowed", () => {
    const d = doc(`<html><head><meta property="og:type" content="article"><meta property="og:title" content="Rates"></head><body><article><p>First.</p><p>Second.</p></article></body></html>`);
    expect(extractPage(d, "https://n.example.com/a", { includeArticleExcerpt: true }).article?.excerpt).toBe("First. Second.");
  });
});

describe("extractPage — travel", () => {
  it("reads hotel JSON-LD", () => {
    const ld = JSON.stringify({ "@type": "Hotel", name: "Park Hyatt Tokyo", address: { addressLocality: "Tokyo" }, priceRange: "$650" });
    const r = extractPage(doc(`<html><head><script type="application/ld+json">${ld}</script></head></html>`), "https://www.hyatt.com/park-hyatt/tokyo");
    expect(r.pageType).toBe("travel");
    expect(r.travel).toMatchObject({ kind: "hotel", destination: "Tokyo", priceCents: 65000 });
  });
});

describe("sanitize", () => {
  it("strips markup, control and bidi characters", () => {
    expect(cleanText("<img src=x onerror=alert(1)>Hello‮\u0000  world")).toBe("Hello world");
    expect(cleanText("a".repeat(20), 10)).toHaveLength(10);
  });
  it("only allows http(s) URLs without credentials", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("https://user:pw@x.com")).toBeNull();
    expect(safeUrl("/img.png", "https://x.com/a")).toBe("https://x.com/img.png");
  });
  it("canonicalizes URLs for dedupe", () => {
    expect(canonicalizeUrl("https://WWW.Example.com/p/1/?utm_campaign=a&b=2&a=1#x")).toBe("https://example.com/p/1?a=1&b=2");
  });
});
