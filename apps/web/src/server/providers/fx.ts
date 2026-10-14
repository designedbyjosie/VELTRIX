/**
 * Currency conversion using the European Central Bank's daily reference rates via
 * Frankfurter (free, no key). Returns null when unavailable — callers never guess a rate.
 */
import { env } from "../env";

export interface FxRate {
  from: string;
  to: string;
  rate: number;
  asOf: string;
  source: string;
}

const cache = new Map<string, { at: number; value: FxRate | null }>();

async function fetchRate(from: string, to: string, fetchImpl: typeof fetch): Promise<FxRate | null> {
  const urls = [
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
      const rate = data.rates?.[to];
      if (typeof rate === "number" && rate > 0) return { from, to, rate, asOf: data.date ?? new Date().toISOString().slice(0, 10), source: "European Central Bank reference rate (via Frankfurter)" };
    } catch {
      /* try the next endpoint */
    }
  }
  return null;
}

export async function fxRate(from: string, to: string, fetchImpl: typeof fetch = fetch): Promise<FxRate | null> {
  if (from === to) return { from, to, rate: 1, asOf: new Date().toISOString().slice(0, 10), source: "identity" };
  if (env.fx.provider !== "frankfurter") return null;
  const key = `${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.value ? 3_600_000 : 300_000)) return hit.value;
  const value = await fetchRate(from, to, fetchImpl);
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearFxCache() {
  cache.clear();
}
