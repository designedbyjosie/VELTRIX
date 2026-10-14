/**
 * Sanitization for untrusted, page-derived text. Webpage content is DATA, never
 * instructions or markup: these helpers strip control characters, collapse
 * whitespace, cap length, and only allow http(s) URLs.
 */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

export function cleanText(input: unknown, max = 300): string {
  if (typeof input !== "string") return "";
  const s = input.replace(CONTROL, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function safeUrl(input: unknown, base?: string): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  try {
    const u = new URL(input.trim(), base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref$|ref_|tag$|psc$|th$|smid$|_encoding$|pd_rd|pf_rd|qid$|sr$|crid$|sprefix$|keywords$)/i;

/** Canonical URL used for dedupe: lowercase host, no hash, tracking params removed. */
export function canonicalizeUrl(input: string): string | null {
  const safe = safeUrl(input);
  if (!safe) return null;
  const u = new URL(safe);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
