/**
 * Market data adapter. The application only talks to `MarketDataProvider`; concrete
 * providers are selected by MARKET_DATA_PROVIDER. When no credentials are configured
 * the DemoMarketProvider returns SIMULATED prices that are labeled as demo data
 * everywhere they are displayed — they are never presented as real quotes.
 */
import { env } from "../env";

export type InstrumentKind = "STOCK" | "ETF" | "FUND" | "BOND" | "CRYPTO" | "OTHER";

export interface InstrumentInfo {
  symbol: string;
  name: string;
  type: InstrumentKind;
  exchange: string;
  currency: string;
  sector: string | null;
  description: string | null;
  dividendYieldPercent?: number | null;
  expenseRatioPercent?: number | null;
}

export interface Quote {
  symbol: string;
  price: number;
  currency: string;
  changePercent: number | null;
  previousClose: number | null;
  asOf: string;
  delayed: boolean;
  source: string;
  isDemo: boolean;
}

export interface Bar {
  date: string;
  close: number;
}

export type HistoryRange = "1M" | "3M" | "6M" | "1Y" | "5Y";

export interface MarketDataProvider {
  id: string;
  label: string;
  isDemo: boolean;
  search(query: string): Promise<InstrumentInfo[]>;
  profile(symbol: string): Promise<InstrumentInfo | null>;
  quote(symbol: string): Promise<Quote | null>;
  history(symbol: string, range: HistoryRange): Promise<Bar[]>;
}

export const RANGE_DAYS: Record<HistoryRange, number> = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365, "5Y": 1826 };

// ------------------------------------------------------------------ demo provider

interface DemoFixture extends InstrumentInfo {
  basePrice: number;
  vol: number;
  drift: number;
}

const DEMO: DemoFixture[] = [
  { symbol: "AAPL", name: "Apple Inc.", type: "STOCK", exchange: "NASDAQ", currency: "USD", sector: "Technology", description: "Designs consumer electronics (iPhone, Mac, iPad, wearables) and sells related software and services.", basePrice: 228, vol: 0.016, drift: 0.0004, dividendYieldPercent: 0.4 },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "STOCK", exchange: "NASDAQ", currency: "USD", sector: "Technology", description: "Develops software (Windows, Office), cloud infrastructure (Azure) and gaming products.", basePrice: 431, vol: 0.014, drift: 0.0004, dividendYieldPercent: 0.7 },
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "STOCK", exchange: "NASDAQ", currency: "USD", sector: "Technology", description: "Designs graphics processors and accelerated-computing platforms used in gaming, data centers and AI.", basePrice: 128, vol: 0.03, drift: 0.0012, dividendYieldPercent: 0.03 },
  { symbol: "AMZN", name: "Amazon.com, Inc.", type: "STOCK", exchange: "NASDAQ", currency: "USD", sector: "Consumer Discretionary", description: "Operates online retail marketplaces and Amazon Web Services cloud computing.", basePrice: 186, vol: 0.019, drift: 0.0005 },
  { symbol: "GOOGL", name: "Alphabet Inc. Class A", type: "STOCK", exchange: "NASDAQ", currency: "USD", sector: "Communication Services", description: "Parent of Google: search and advertising, YouTube, Android and Google Cloud.", basePrice: 165, vol: 0.017, drift: 0.0004, dividendYieldPercent: 0.5 },
  { symbol: "TSLA", name: "Tesla, Inc.", type: "STOCK", exchange: "NASDAQ", currency: "USD", sector: "Consumer Discretionary", description: "Manufactures electric vehicles and energy storage and generation products.", basePrice: 240, vol: 0.035, drift: 0.0003 },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", type: "STOCK", exchange: "NASDAQ", currency: "USD", sector: "Technology", description: "Designs CPUs, GPUs and adaptive chips for PCs, data centers and embedded systems.", basePrice: 152, vol: 0.028, drift: 0.0004 },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "STOCK", exchange: "NYSE", currency: "USD", sector: "Financials", description: "Global bank offering consumer banking, investment banking, and asset management.", basePrice: 212, vol: 0.013, drift: 0.0003, dividendYieldPercent: 2.2 },
  { symbol: "KO", name: "The Coca-Cola Company", type: "STOCK", exchange: "NYSE", currency: "USD", sector: "Consumer Staples", description: "Makes and markets non-alcoholic beverage concentrates and brands worldwide.", basePrice: 70, vol: 0.008, drift: 0.0001, dividendYieldPercent: 2.8 },
  { symbol: "JNJ", name: "Johnson & Johnson", type: "STOCK", exchange: "NYSE", currency: "USD", sector: "Health Care", description: "Develops pharmaceuticals and medical technology products.", basePrice: 162, vol: 0.009, drift: 0.0001, dividendYieldPercent: 3.0 },
  { symbol: "SONY", name: "Sony Group Corporation", type: "STOCK", exchange: "NYSE", currency: "USD", sector: "Technology", description: "Makes consumer electronics, image sensors, games (PlayStation), music and films.", basePrice: 19, vol: 0.016, drift: 0.0002 },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF", exchange: "NYSEARCA", currency: "USD", sector: "Broad Market", description: "Index fund that seeks to track the S&P 500, a broad index of large U.S. companies.", basePrice: 525, vol: 0.009, drift: 0.0004, dividendYieldPercent: 1.3, expenseRatioPercent: 0.03 },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", exchange: "NYSEARCA", currency: "USD", sector: "Broad Market", description: "Index fund tracking the entire U.S. stock market across company sizes.", basePrice: 285, vol: 0.009, drift: 0.0004, dividendYieldPercent: 1.3, expenseRatioPercent: 0.03 },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF", exchange: "NASDAQ", currency: "USD", sector: "Technology", description: "Tracks the Nasdaq-100 index of large non-financial companies listed on Nasdaq.", basePrice: 490, vol: 0.012, drift: 0.0005, dividendYieldPercent: 0.6, expenseRatioPercent: 0.2 },
  { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", type: "ETF", exchange: "NYSEARCA", currency: "USD", sector: "Dividend", description: "Tracks an index of U.S. companies with a record of paying dividends.", basePrice: 28, vol: 0.008, drift: 0.0002, dividendYieldPercent: 3.5, expenseRatioPercent: 0.06 },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", type: "ETF", exchange: "NASDAQ", currency: "USD", sector: "Fixed Income", description: "Tracks investment-grade U.S. bonds, including government and corporate debt.", basePrice: 73, vol: 0.003, drift: 0.00005, dividendYieldPercent: 3.6, expenseRatioPercent: 0.03 },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF", type: "ETF", exchange: "NASDAQ", currency: "USD", sector: "International", description: "Tracks stocks of companies outside the United States in developed and emerging markets.", basePrice: 63, vol: 0.009, drift: 0.0002, dividendYieldPercent: 3.0, expenseRatioPercent: 0.05 },
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

/** Deterministic simulated daily closes ending today at the fixture's base price. */
function simulatedSeries(f: DemoFixture, days: number, today = new Date()): Bar[] {
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const total = 1900;
  const rand = mulberry32(hashSeed(f.symbol));
  const rets: number[] = [];
  for (let i = 0; i < total; i++) {
    const n = rand() + rand() + rand() - 1.5; // ≈ normal(0, 0.5)
    rets.push(f.drift + n * f.vol * 2);
  }
  // Walk backwards from the base price so "today" always equals basePrice.
  const closes: number[] = new Array(total);
  closes[total - 1] = f.basePrice;
  for (let i = total - 2; i >= 0; i--) closes[i] = closes[i + 1] / (1 + rets[i + 1]);
  const out: Bar[] = [];
  for (let i = total - days; i < total; i++) {
    const date = new Date(end - (total - 1 - i) * DAY);
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    out.push({ date: date.toISOString().slice(0, 10), close: Math.round(closes[i] * 100) / 100 });
  }
  return out;
}

export class DemoMarketProvider implements MarketDataProvider {
  id = "demo";
  label = "VELTRIX demo data (simulated, not real market prices)";
  isDemo = true;

  async search(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return DEMO.slice(0, 10).map(strip);
    return DEMO.filter((f) => f.symbol.toLowerCase().startsWith(q) || f.name.toLowerCase().includes(q)).slice(0, 10).map(strip);
  }
  async profile(symbol: string) {
    const f = DEMO.find((x) => x.symbol === symbol.toUpperCase());
    return f ? strip(f) : null;
  }
  async quote(symbol: string): Promise<Quote | null> {
    const f = DEMO.find((x) => x.symbol === symbol.toUpperCase());
    if (!f) return null;
    const s = simulatedSeries(f, 10);
    const last = s[s.length - 1];
    const prev = s[s.length - 2];
    return {
      symbol: f.symbol,
      price: last.close,
      currency: f.currency,
      previousClose: prev.close,
      changePercent: Math.round(((last.close - prev.close) / prev.close) * 10000) / 100,
      asOf: new Date(`${last.date}T21:00:00Z`).toISOString(),
      delayed: true,
      source: "demo",
      isDemo: true,
    };
  }
  async history(symbol: string, range: HistoryRange) {
    const f = DEMO.find((x) => x.symbol === symbol.toUpperCase());
    return f ? simulatedSeries(f, RANGE_DAYS[range]) : [];
  }
}

function strip(f: DemoFixture): InstrumentInfo {
  const { basePrice: _b, vol: _v, drift: _d, ...info } = f;
  return info;
}

// ------------------------------------------------------------------ Alpha Vantage

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Alpha Vantage adapter (https://www.alphavantage.co). Requires ALPHA_VANTAGE_API_KEY.
 * Free-tier data is end-of-day/delayed and rate limited; check the provider's terms
 * before commercial use. Responses are mapped defensively: missing fields yield null.
 */
export class AlphaVantageProvider implements MarketDataProvider {
  id = "alphavantage";
  label = "Alpha Vantage (delayed)";
  isDemo = false;
  constructor(private apiKey: string) {}

  private async call(params: Record<string, string>): Promise<Record<string, unknown> | null> {
    const url = new URL("https://www.alphavantage.co/query");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("apikey", this.apiKey);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (data.Note || data.Information || data["Error Message"]) return null;
    return data;
  }

  async search(query: string) {
    return cached(`s:${query}`, 3_600_000, async () => {
      const d = await this.call({ function: "SYMBOL_SEARCH", keywords: query });
      const matches = (d?.bestMatches as Record<string, string>[] | undefined) ?? [];
      return matches.slice(0, 10).map((m) => ({
        symbol: m["1. symbol"],
        name: m["2. name"],
        type: (m["3. type"] === "ETF" ? "ETF" : m["3. type"] === "Mutual Fund" ? "FUND" : "STOCK") as InstrumentKind,
        exchange: m["4. region"] ?? "",
        currency: m["8. currency"] ?? "USD",
        sector: null,
        description: null,
      }));
    });
  }
  async profile(symbol: string) {
    return cached(`p:${symbol}`, 86_400_000, async () => {
      const d = await this.call({ function: "OVERVIEW", symbol });
      if (!d || !d.Symbol) return null;
      const dy = Number(d.DividendYield);
      return {
        symbol: String(d.Symbol),
        name: String(d.Name ?? symbol),
        type: (String(d.AssetType ?? "").toUpperCase().includes("ETF") ? "ETF" : "STOCK") as InstrumentKind,
        exchange: String(d.Exchange ?? ""),
        currency: String(d.Currency ?? "USD"),
        sector: d.Sector ? String(d.Sector) : null,
        description: d.Description ? String(d.Description).slice(0, 1200) : null,
        dividendYieldPercent: Number.isFinite(dy) ? Math.round(dy * 10000) / 100 : null,
      };
    });
  }
  async quote(symbol: string) {
    return cached(`q:${symbol}`, 60_000, async () => {
      const d = await this.call({ function: "GLOBAL_QUOTE", symbol });
      const q = d?.["Global Quote"] as Record<string, string> | undefined;
      if (!q || !q["05. price"]) return null;
      const price = Number(q["05. price"]);
      const prev = Number(q["08. previous close"]);
      return {
        symbol,
        price,
        currency: "USD",
        previousClose: Number.isFinite(prev) ? prev : null,
        changePercent: q["10. change percent"] ? Number(q["10. change percent"].replace("%", "")) : null,
        asOf: q["07. latest trading day"] ? new Date(`${q["07. latest trading day"]}T21:00:00Z`).toISOString() : new Date().toISOString(),
        delayed: true,
        source: "Alpha Vantage",
        isDemo: false,
      } satisfies Quote;
    });
  }
  async history(symbol: string, range: HistoryRange) {
    return cached(`h:${symbol}:${range}`, 3_600_000, async () => {
      const d = await this.call({ function: "TIME_SERIES_DAILY", symbol, outputsize: range === "1M" || range === "3M" ? "compact" : "full" });
      const series = d?.["Time Series (Daily)"] as Record<string, Record<string, string>> | undefined;
      if (!series) return [];
      const since = new Date(Date.now() - RANGE_DAYS[range] * DAY).toISOString().slice(0, 10);
      return Object.entries(series)
        .filter(([date]) => date >= since)
        .map(([date, v]) => ({ date, close: Number(v["4. close"]) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    });
  }
}

let provider: MarketDataProvider | null = null;
export function marketData(): MarketDataProvider {
  if (provider) return provider;
  provider = env.market.provider === "alphavantage" && env.market.alphaVantageKey ? new AlphaVantageProvider(env.market.alphaVantageKey) : new DemoMarketProvider();
  return provider;
}

export const DEMO_SYMBOLS = DEMO.map((d) => d.symbol);
