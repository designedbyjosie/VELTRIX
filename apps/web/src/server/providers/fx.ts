/** Currency conversion adapter. Returns null when no provider is configured — callers must not guess. */
import { env } from "../env";

export interface FxRate {
  from: string;
  to: string;
  rate: number;
  asOf: string;
  source: string;
}

const cache = new Map<string, { at: number; value: FxRate | null }>();

export async function fxRate(from: string, to: string): Promise<FxRate | null> {
  if (from === to) return { from, to, rate: 1, asOf: new Date().toISOString(), source: "identity" };
  if (env.fx.provider !== "frankfurter") return null;
  const key = `${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.value;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { date: string; rates: Record<string, number> };
    const rate = data.rates?.[to];
    const value = typeof rate === "number" ? { from, to, rate, asOf: data.date, source: "Frankfurter / ECB reference rate" } : null;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}
