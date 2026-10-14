import { describe, expect, it } from "vitest";
import { FinnhubProvider, NoMarketData, type MarketDataProvider } from "@/server/providers/market";
import { fxRate, clearFxCache } from "@/server/providers/fx";

type Route = (url: URL, init?: RequestInit) => { status?: number; body: unknown };

function mockFetch(route: Route) {
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  const fn = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = route(url, init);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fn, calls };
}

describe("Finnhub provider", () => {
  const fixtures: Route = (url) => {
    const sym = url.searchParams.get("symbol");
    switch (url.pathname) {
      case "/api/v1/quote":
        return { body: sym === "ZZZZ" ? { c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 } : { c: 231.5, d: 2.1, dp: 0.9154, h: 233, l: 229, o: 230, pc: 229.4, t: 1760472000 } };
      case "/api/v1/stock/profile2":
        return { body: sym === "VOO" ? {} : { country: "US", currency: "USD", exchange: "NASDAQ NMS - GLOBAL MARKET", name: "Apple Inc", ticker: "AAPL", finnhubIndustry: "Technology" } };
      case "/api/v1/search":
        return { body: { count: 3, result: [{ description: "VANGUARD S&P 500 ETF", displaySymbol: "VOO", symbol: "VOO", type: "ETP" }, { description: "APPLE INC", displaySymbol: "AAPL", symbol: "AAPL", type: "Common Stock" }, { description: "APPLE INC", displaySymbol: "AAPL.MX", symbol: "AAPL.MX", type: "Common Stock" }] } };
      case "/api/v1/stock/candle":
        return { status: 403, body: { error: "You don't have access to this resource." } };
      case "/api/v1/company-news":
        return { body: [{ category: "company", datetime: 1760400000, headline: "Apple unveils new chips", id: 1, image: "", related: "AAPL", source: "Reuters", summary: "Summary text", url: "https://example.com/a" }, { headline: "bad", url: "javascript:alert(1)", datetime: 1 }] };
      default:
        return { status: 404, body: {} };
    }
  };

  it("maps quotes, keeps the API key out of URLs, and treats zero quotes as unknown", async () => {
    const { fn, calls } = mockFetch(fixtures);
    const p = new FinnhubProvider("secret-key", null, fn);
    const q = await p.quote("AAPL");
    expect(q).toMatchObject({ symbol: "AAPL", price: 231.5, previousClose: 229.4, changePercent: 0.92, isDemo: false, source: "Finnhub" });
    expect(q!.asOf).toBe(new Date(1760472000 * 1000).toISOString());
    expect(await p.quote("ZZZZ")).toBeNull();
    expect(calls.every((c) => !c.url.toString().includes("secret-key") && c.headers["X-Finnhub-Token"] === "secret-key")).toBe(true);
  });

  it("maps profiles, falling back to search listings for ETFs", async () => {
    const p = new FinnhubProvider("k", null, mockFetch(fixtures).fn);
    expect(await p.profile("AAPL")).toMatchObject({ name: "Apple Inc", sector: "Technology", type: "STOCK" });
    expect(await p.profile("VOO")).toMatchObject({ symbol: "VOO", name: "VANGUARD S&P 500 ETF", type: "ETF" });
    const results = await p.search("app");
    expect(results.map((r) => r.symbol)).toEqual(["VOO", "AAPL"]); // foreign listings filtered
  });

  it("uses the history fallback when candles aren't on the plan, and returns no fake history otherwise", async () => {
    const fallback: MarketDataProvider = { ...new NoMarketData(), history: async () => [{ date: "2026-10-13", close: 230 }] };
    expect(await new FinnhubProvider("k", fallback, mockFetch(fixtures).fn).history("AAPL", "1M")).toEqual([{ date: "2026-10-13", close: 230 }]);
    expect(await new FinnhubProvider("k2", null, mockFetch(fixtures).fn).history("MSFT", "1M")).toEqual([]);
  });

  it("returns only http(s) news items with their source and time", async () => {
    const news = await new FinnhubProvider("k3", null, mockFetch(fixtures).fn).news("AAPL");
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({ headline: "Apple unveils new chips", source: "Reuters", url: "https://example.com/a" });
  });

  it("never returns prices when nothing is configured", async () => {
    const none = new NoMarketData();
    expect(await none.quote()).toBeNull();
    expect(await none.history()).toEqual([]);
  });
});

describe("exchange rates", () => {
  it("parses ECB rates and falls back to the second endpoint", async () => {
    clearFxCache();
    const { fn, calls } = mockFetch((url) => (url.hostname === "api.frankfurter.dev" ? { status: 503, body: {} } : { body: { amount: 1, base: "EUR", date: "2026-10-13", rates: { USD: 1.0921 } } }));
    const r = await fxRate("EUR", "USD", fn);
    expect(r).toMatchObject({ rate: 1.0921, asOf: "2026-10-13" });
    expect(calls.map((c) => c.url.hostname)).toEqual(["api.frankfurter.dev", "api.frankfurter.app"]);
  });
  it("returns null rather than guessing when no rate is available", async () => {
    clearFxCache();
    const { fn } = mockFetch(() => ({ status: 500, body: {} }));
    expect(await fxRate("GBP", "USD", fn)).toBeNull();
    expect((await fxRate("USD", "USD", fn))!.rate).toBe(1);
  });
});
