/**
 * Page extraction for the VELTRIX browser extension.
 *
 * Runs inside the page (injected on user request) and returns a small, typed
 * summary. It is deliberately conservative:
 *   - reads only public display metadata (JSON-LD, OpenGraph, microdata, titles)
 *   - never reads form controls (input/textarea/select values), cookies or storage
 *   - never executes or evaluates page-provided code (JSON-LD is parsed with JSON.parse)
 *   - refuses sensitive pages (checkout, payment, login, banking)
 *   - every string is sanitized and length-capped
 */
import { parseAmount } from "../money";
import { canonicalizeUrl, cleanText, domainOf, safeUrl } from "../sanitize";

export type PageType = "product" | "article" | "instrument" | "travel" | "unsupported";

export interface ExtractedProduct {
  title: string;
  priceCents: number | null;
  currency: string | null;
  merchant: string;
  imageUrl: string | null;
  availability: string | null;
  brand: string | null;
  sku: string | null;
  gtin: string | null;
}

export interface ExtractedArticle {
  headline: string;
  publisher: string | null;
  publishedAt: string | null;
  description: string | null;
  /** Only populated when the user has consented to sending page content. */
  excerpt: string | null;
}

export interface ExtractedTravel {
  kind: "flight" | "hotel" | "car" | "package" | "unknown";
  provider: string;
  title: string;
  priceCents: number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  destination: string | null;
}

export interface PageExtraction {
  url: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  pageType: PageType;
  unsupportedReason?: "sensitive" | "no-financial-content" | "not-http";
  product?: ExtractedProduct;
  article?: ExtractedArticle;
  travel?: ExtractedTravel;
  symbols: string[];
  signals: string[];
  extractedAt: string;
}

export interface ExtractOptions {
  includeArticleExcerpt?: boolean;
}

const SENSITIVE_PATH = /(checkout|\/cart\b|basket|payment|billing|\/pay\b|signin|sign-in|login|log-in|\/account|password|\/auth|\/wallet|onlinebanking|\/banking)/i;
const SENSITIVE_HOST = /(^|\.)(paypal\.com|stripe\.com|chase\.com|bankofamerica\.com|wellsfargo\.com|citi\.com|capitalone\.com|accounts\.google\.com|login\.)/i;

const SHOPPING_HOSTS = /(^|\.)(amazon\.[a-z.]+|bestbuy\.com|walmart\.com|target\.com|ebay\.[a-z.]+|etsy\.com|costco\.com|newegg\.com|homedepot\.com|lowes\.com|apple\.com|bhphotovideo\.com|wayfair\.com|ikea\.com)$/i;
const TRAVEL_HOSTS: [RegExp, ExtractedTravel["kind"]][] = [
  [/(^|\.)(delta|united|aa|southwest|jetblue|alaskaair|lufthansa|britishairways|airfrance|ryanair|easyjet|emirates|skyscanner|kayak|google)\.[a-z.]+$/i, "flight"],
  [/(^|\.)(booking|hotels|marriott|hilton|hyatt|ihg|airbnb|vrbo|agoda|trivago)\.[a-z.]+$/i, "hotel"],
  [/(^|\.)(hertz|avis|enterprise|budget|sixt|turo)\.[a-z.]+$/i, "car"],
  [/(^|\.)(expedia|priceline|orbitz|travelocity)\.[a-z.]+$/i, "package"],
];
const NEWS_HOSTS = /(^|\.)(reuters\.com|bloomberg\.com|cnbc\.com|wsj\.com|ft\.com|marketwatch\.com|barrons\.com|fool\.com|investopedia\.com|finance\.yahoo\.com|forbes\.com|businessinsider\.com|economist\.com|nytimes\.com|apnews\.com)$/i;

const CURRENCY_SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR" };
const COMMON_WORDS = new Set(["A", "I", "CEO", "CFO", "USA", "US", "UK", "EU", "AI", "IPO", "ETF", "GDP", "SEC", "FED", "THE", "AND", "FOR", "NEW", "Q1", "Q2", "Q3", "Q4", "EPS", "YOY", "USD"]);

type Json = Record<string, unknown>;

function meta(doc: Document, ...names: string[]): string | null {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`);
    const v = el?.getAttribute("content");
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function typesOf(node: Json): string[] {
  return asArray(node["@type"] as string | string[]).map((t) => String(t).toLowerCase());
}

/** Parse every JSON-LD block safely and flatten @graph containers. */
export function readJsonLd(doc: Document): Json[] {
  const out: Json[] = [];
  const blocks = doc.querySelectorAll('script[type="application/ld+json"]');
  blocks.forEach((b, i) => {
    if (i > 20) return;
    const text = b.textContent ?? "";
    if (text.length > 200_000) return;
    try {
      const parsed = JSON.parse(text);
      const stack = asArray(parsed as Json | Json[]);
      while (stack.length && out.length < 100) {
        const node = stack.shift();
        if (!node || typeof node !== "object") continue;
        out.push(node);
        if (Array.isArray(node["@graph"])) stack.push(...(node["@graph"] as Json[]));
        if (node.mainEntity && typeof node.mainEntity === "object") stack.push(node.mainEntity as Json);
      }
    } catch {
      /* malformed JSON-LD is ignored */
    }
  });
  return out;
}

function priceFrom(raw: unknown, currencyHint: string | null): { cents: number | null; currency: string | null } {
  if (raw === undefined || raw === null || raw === "") return { cents: null, currency: currencyHint };
  const s = cleanText(String(raw), 40);
  let currency = currencyHint;
  const sym = s.match(/[$€£¥₹]/);
  if (!currency && sym) currency = CURRENCY_SYMBOLS[sym[0]] ?? null;
  const code = s.match(/\b([A-Z]{3})\b/);
  if (!currency && code) currency = code[1];
  const numeric = s.replace(/[^0-9.,()-]/g, "");
  const cents = parseAmount(numeric);
  return { cents: cents !== null && cents > 0 && cents < 10_000_000_00 ? cents : null, currency: currency ? currency.toUpperCase().slice(0, 3) : null };
}

function nameOf(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return cleanText(v, 120);
  if (typeof v === "object" && v !== null && "name" in v) return cleanText((v as Json).name, 120) || null;
  return null;
}

function merchantName(doc: Document, domain: string): string {
  const site = meta(doc, "og:site_name", "application-name");
  if (site) return cleanText(site, 80);
  const base = domain.split(".").slice(-2, -1)[0] ?? domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function extractProduct(doc: Document, url: string, domain: string, ld: Json[], signals: string[]): ExtractedProduct | null {
  const productNode = ld.find((n) => typesOf(n).includes("product"));
  let title: string | null = null;
  let priceCents: number | null = null;
  let currency: string | null = null;
  let imageUrl: string | null = null;
  let availability: string | null = null;
  let brand: string | null = null;
  let sku: string | null = null;
  let gtin: string | null = null;

  if (productNode) {
    signals.push("json-ld:Product");
    title = cleanText(productNode.name, 200) || null;
    const offers = asArray(productNode.offers as Json | Json[]);
    const offer = offers.find((o) => o && (o.price !== undefined || o.lowPrice !== undefined)) ?? offers[0];
    if (offer) {
      const cur = typeof offer.priceCurrency === "string" ? offer.priceCurrency : null;
      const p = priceFrom(offer.price ?? offer.lowPrice, cur);
      priceCents = p.cents;
      currency = p.currency;
      if (typeof offer.availability === "string") availability = cleanText(offer.availability.split("/").pop(), 40);
    }
    const img = asArray(productNode.image as unknown)[0];
    imageUrl = safeUrl(typeof img === "string" ? img : (img as Json | undefined)?.url, url);
    brand = nameOf(productNode.brand);
    sku = cleanText(productNode.sku, 64) || null;
    gtin = cleanText(productNode.gtin13 ?? productNode.gtin12 ?? productNode.gtin ?? productNode.gtin14, 20) || null;
  }

  const ogType = meta(doc, "og:type");
  if (ogType && /product/i.test(ogType)) signals.push("og:type=product");
  if (priceCents === null) {
    const amount = meta(doc, "product:price:amount", "og:price:amount");
    if (amount) {
      const p = priceFrom(amount, meta(doc, "product:price:currency", "og:price:currency"));
      priceCents = p.cents;
      currency = currency ?? p.currency;
      if (p.cents !== null) signals.push("og:price");
    }
  }
  if (priceCents === null) {
    const el = doc.querySelector('[itemprop="price"]');
    if (el && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
      const p = priceFrom(el.getAttribute("content") ?? el.textContent, doc.querySelector('[itemprop="priceCurrency"]')?.getAttribute("content") ?? null);
      priceCents = p.cents;
      currency = currency ?? p.currency;
      if (p.cents !== null) signals.push("microdata:price");
    }
  }
  // Amazon-style product pages expose display-only elements rather than JSON-LD.
  if (/(^|\.)amazon\./i.test(domain)) {
    const t = doc.querySelector("#productTitle")?.textContent;
    if (t && !title) title = cleanText(t, 200);
    if (priceCents === null) {
      const priceEl = doc.querySelector("#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, .a-price .a-offscreen");
      if (priceEl) {
        const p = priceFrom(priceEl.textContent, null);
        priceCents = p.cents;
        currency = currency ?? p.currency;
        if (p.cents !== null) signals.push("amazon:price");
      }
    }
    if (!imageUrl) imageUrl = safeUrl(doc.querySelector("#landingImage")?.getAttribute("src"), url);
  }

  const looksLikeShop = SHOPPING_HOSTS.test(domain) || !!productNode || (ogType ?? "").toLowerCase().includes("product");
  if (!looksLikeShop || priceCents === null) return null;
  title = title ?? cleanText(meta(doc, "og:title") ?? doc.title, 200);
  if (!title) return null;
  return {
    title,
    priceCents,
    currency: currency ?? "USD",
    merchant: merchantName(doc, domain),
    imageUrl: imageUrl ?? safeUrl(meta(doc, "og:image"), url),
    availability,
    brand,
    sku,
    gtin,
  };
}

function extractArticle(doc: Document, domain: string, ld: Json[], signals: string[], includeExcerpt: boolean): ExtractedArticle | null {
  const node = ld.find((n) => typesOf(n).some((t) => t.endsWith("article") || t === "blogposting" || t === "reportagenewsarticle"));
  const ogType = meta(doc, "og:type");
  const isArticle = !!node || /article/i.test(ogType ?? "") || NEWS_HOSTS.test(domain);
  if (!isArticle) return null;
  if (node) signals.push("json-ld:Article");
  else if (ogType) signals.push(`og:type=${ogType}`);
  else signals.push("news-domain");
  const headline = cleanText((node?.headline as string) ?? meta(doc, "og:title") ?? doc.title, 240);
  if (!headline) return null;
  const published = (node?.datePublished as string) ?? meta(doc, "article:published_time", "datePublished");
  let excerpt: string | null = null;
  if (includeExcerpt) {
    const paras = Array.from(doc.querySelectorAll("article p, main p")).slice(0, 8);
    excerpt = cleanText(paras.map((p) => p.textContent ?? "").join(" "), 2000) || null;
  }
  return {
    headline,
    publisher: nameOf(node?.publisher) ?? (meta(doc, "og:site_name") ? cleanText(meta(doc, "og:site_name"), 80) : null),
    publishedAt: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null,
    description: cleanText(meta(doc, "og:description", "description") ?? (node?.description as string), 400) || null,
    excerpt,
  };
}

/** Detect ticker symbols from well-known quote URLs and explicit textual markers. */
export function detectSymbols(doc: Document, url: string): { symbols: string[]; fromUrl: boolean } {
  const found = new Set<string>();
  let fromUrl = false;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;
  const urlPatterns: [RegExp, RegExp][] = [
    [/finance\.yahoo\.com$/, /^\/quote\/([A-Za-z.\-^]{1,10})/],
    [/google\.com$/, /^\/finance\/quote\/([A-Za-z.\-]{1,10}):/],
    [/marketwatch\.com$/, /^\/investing\/(?:stock|fund|index)\/([A-Za-z.\-]{1,10})/],
    [/nasdaq\.com$/, /^\/market-activity\/(?:stocks|etf|funds-and-etfs)\/([A-Za-z.\-]{1,10})/],
    [/seekingalpha\.com$/, /^\/symbol\/([A-Za-z.\-]{1,10})/],
    [/cnbc\.com$/, /^\/quotes\/([A-Za-z.\-]{1,10})/],
    [/morningstar\.com$/, /^\/(?:stocks|etfs|funds)\/[a-z]+\/([A-Za-z.\-]{1,10})/],
  ];
  for (const [h, p] of urlPatterns) {
    if (h.test(host)) {
      const m = path.match(p);
      if (m) {
        found.add(m[1].toUpperCase());
        fromUrl = true;
      }
    }
  }
  const text = [doc.title, meta(doc, "og:title"), meta(doc, "og:description", "description"), ...Array.from(doc.querySelectorAll("h1, h2, article p")).slice(0, 30).map((e) => e.textContent ?? "")]
    .filter(Boolean)
    .join(" ")
    .slice(0, 20_000);
  for (const m of text.matchAll(/\$([A-Z]{1,5})\b/g)) if (!COMMON_WORDS.has(m[1])) found.add(m[1]);
  for (const m of text.matchAll(/\((?:NASDAQ|NYSE|NYSEARCA|AMEX|NYSE American|TSX|LSE)\s*:\s*([A-Z.]{1,6})\)/g)) found.add(m[1]);
  for (const m of text.matchAll(/\b(?:NASDAQ|NYSE)\s*:\s*([A-Z.]{1,6})\b/g)) found.add(m[1]);
  return { symbols: [...found].filter((s) => /^[A-Z][A-Z.\-^]{0,9}$/.test(s)).slice(0, 12), fromUrl };
}

function extractTravel(doc: Document, url: string, domain: string, ld: Json[], signals: string[]): ExtractedTravel | null {
  const hostKind = TRAVEL_HOSTS.find(([re]) => re.test(domain))?.[1];
  if (domain.endsWith("google.com") && !new URL(url).pathname.startsWith("/travel")) return null;
  const node = ld.find((n) =>
    typesOf(n).some((t) => ["hotel", "lodgingbusiness", "flight", "flightreservation", "lodgingreservation", "trip", "rentalcarreservation", "vacationrental"].includes(t)),
  );
  if (!hostKind && !node) return null;
  const types = node ? typesOf(node) : [];
  const kind: ExtractedTravel["kind"] = types.some((t) => t.includes("flight"))
    ? "flight"
    : types.some((t) => t.includes("hotel") || t.includes("lodging") || t.includes("vacationrental"))
      ? "hotel"
      : types.some((t) => t.includes("car"))
        ? "car"
        : hostKind ?? "unknown";
  if (node) signals.push(`json-ld:${types[0]}`);
  else signals.push("travel-domain");
  let priceCents: number | null = null;
  let currency: string | null = null;
  const offers = asArray((node?.offers ?? node?.priceSpecification) as Json | Json[]);
  const offer = offers[0];
  if (offer) {
    const p = priceFrom(offer.price ?? offer.lowPrice, typeof offer.priceCurrency === "string" ? offer.priceCurrency : null);
    priceCents = p.cents;
    currency = p.currency;
  } else if (node?.priceRange) {
    const p = priceFrom(node.priceRange, null);
    priceCents = p.cents;
    currency = p.currency;
  }
  const dateOf = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString().slice(0, 10) : null);
  const address = node?.address as Json | undefined;
  return {
    kind,
    provider: merchantName(doc, domain),
    title: cleanText((node?.name as string) ?? meta(doc, "og:title") ?? doc.title, 200),
    priceCents,
    currency: priceCents !== null ? currency ?? "USD" : null,
    startDate: dateOf(node?.checkinTime ?? node?.departureTime ?? node?.startDate),
    endDate: dateOf(node?.checkoutTime ?? node?.arrivalTime ?? node?.endDate),
    destination: cleanText((address?.addressLocality as string) ?? nameOf(node?.arrivalAirport) ?? "", 80) || null,
  };
}

export function extractPage(doc: Document, rawUrl: string, options: ExtractOptions = {}): PageExtraction {
  const extractedAt = new Date().toISOString();
  const url = safeUrl(rawUrl);
  const base = { title: "", symbols: [] as string[], signals: [] as string[], extractedAt };
  if (!url) return { ...base, url: "", canonicalUrl: "", domain: "", pageType: "unsupported", unsupportedReason: "not-http" };
  const domain = domainOf(url) ?? "";
  const canonicalUrl = canonicalizeUrl(url) ?? url;
  const title = cleanText(doc.title, 200);
  const u = new URL(url);
  if (SENSITIVE_PATH.test(u.pathname) || SENSITIVE_HOST.test(domain)) {
    return { ...base, url, canonicalUrl, domain, title, pageType: "unsupported", unsupportedReason: "sensitive" };
  }
  const signals: string[] = [];
  const ld = readJsonLd(doc);
  const { symbols, fromUrl } = detectSymbols(doc, url);

  const product = extractProduct(doc, url, domain, ld, signals);
  if (product) return { ...base, url, canonicalUrl, domain, title, pageType: "product", product, symbols: [], signals };

  const travel = extractTravel(doc, url, domain, ld, signals);
  if (travel) return { ...base, url, canonicalUrl, domain, title, pageType: "travel", travel, symbols: [], signals };

  if (fromUrl) {
    signals.push("quote-url");
    return { ...base, url, canonicalUrl, domain, title, pageType: "instrument", symbols, signals };
  }

  const article = extractArticle(doc, domain, ld, signals, !!options.includeArticleExcerpt);
  if (article) return { ...base, url, canonicalUrl, domain, title, pageType: "article", article, symbols, signals };

  if (symbols.length) {
    signals.push("ticker-mentions");
    return { ...base, url, canonicalUrl, domain, title, pageType: "instrument", symbols, signals };
  }
  return { ...base, url, canonicalUrl, domain, title, pageType: "unsupported", unsupportedReason: "no-financial-content", signals };
}
