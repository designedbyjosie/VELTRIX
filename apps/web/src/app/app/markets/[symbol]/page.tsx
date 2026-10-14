import { notFound } from "next/navigation";
import { requireUser } from "@/server/current-user";
import { marketData } from "@/server/providers/market";
import { instrumentMetrics } from "@/server/ai/tools";
import { listAlerts, watchedSymbols } from "@/server/services/investments";
import { db } from "@/server/db";
import { cents } from "@/server/money";
import { Badge, Card, DemoBadge, LinkButton } from "@/components/ui";
import { InstrumentChart } from "@/components/markets/instrument-chart";
import { WatchButton } from "@/components/markets/watch-button";
import { AlertsCard } from "@/components/markets/markets-view";
import { money } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  return { title: decodeURIComponent((await params).symbol).toUpperCase() };
}

export default async function InstrumentPage({ params }: { params: Promise<{ symbol: string }> }) {
  const user = await requireUser();
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-^]{0,9}$/.test(symbol)) notFound();
  const md = marketData();
  const [metrics, history, watched, alerts, holdings, articles, news] = await Promise.all([
    instrumentMetrics(symbol),
    md.history(symbol, "1Y"),
    watchedSymbols(user.id),
    listAlerts(user.id),
    db.investmentHolding.findMany({ where: { userId: user.id, instrument: { symbol } }, include: { account: true } }),
    db.savedArticle.findMany({ where: { userId: user.id, mentionedSymbols: { has: symbol } }, orderBy: { createdAt: "desc" }, take: 5 }),
    md.news ? md.news(symbol).catch(() => []) : Promise.resolve([]),
  ]);
  if (!metrics) {
    return (
      <div className="panel p-8 text-center">
        <h1 className="font-display text-xl font-semibold">{symbol}</h1>
        <p className="mt-2 text-ink2">No data for {symbol} is available from the configured market data source ({md.label}).</p>
        <div className="mt-4 flex justify-center gap-2">
          <WatchButton symbol={symbol} watching={watched.has(symbol)} />
          <LinkButton href="/app/markets" size="sm">Back to markets</LinkButton>
        </div>
      </div>
    );
  }
  const m = metrics;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink2">
            {m.type && <Badge>{m.type}</Badge>} {m.sector && <span>{m.sector}</span>} {m.isDemo && <DemoBadge label="Simulated demo data" />}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold">
            {m.symbol} <span className="text-ink2">· {m.name}</span>
          </h1>
          <p className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="num font-display text-3xl font-semibold">{m.price !== null ? m.price.toFixed(2) : "—"}</span>
            <span className="text-sm text-ink3">{m.currency}</span>
            {m.dayChangePercent !== null && <span className={`num text-sm ${m.dayChangePercent >= 0 ? "text-pos" : "text-neg"}`}>{m.dayChangePercent > 0 ? "+" : ""}{m.dayChangePercent.toFixed(2)}% day</span>}
          </p>
          <p className="text-[11px] text-ink3">
            {m.asOf ? `As of ${new Date(m.asOf).toUTCString()} · ` : ""}
            {m.dataSource} · delayed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <WatchButton symbol={symbol} watching={watched.has(symbol)} />
          <LinkButton size="sm" href={`/app/advisor?q=${encodeURIComponent(`Tell me about ${symbol} and its risks`)}`}>
            Ask the AI advisor
          </LinkButton>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Price history">
          <InstrumentChart symbol={symbol} initial={history} currency={m.currency ?? "USD"} />
        </Card>
        <div className="space-y-4">
          <Card title="Key figures (computed)">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["1-year price return", m.oneYearReturnPercent !== null ? `${m.oneYearReturnPercent}%` : "—"],
                ["Annualized volatility", m.annualizedVolatilityPercent !== null ? `${m.annualizedVolatilityPercent}%` : "—"],
                ["Max drawdown (1Y)", m.maxDrawdownPercent !== null ? `${m.maxDrawdownPercent}%` : "—"],
                ["Dividend yield", m.dividendYieldPercent != null ? `~${m.dividendYieldPercent}%` : "Not available"],
                ["Expense ratio", m.expenseRatioPercent != null ? `${m.expenseRatioPercent}%` : m.type === "ETF" ? "Not available" : "n/a"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-ink3">{k}</dt>
                  <dd className="num text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] text-ink3">Calculated by VELTRIX from daily closes. Past performance doesn&apos;t predict future results.</p>
          </Card>
          {m.description && (
            <Card title="About">
              <p className="text-sm text-ink2">{m.description}</p>
              <p className="mt-2 text-[11px] text-ink3">Source: {m.dataSource}</p>
            </Card>
          )}
          {holdings.length > 0 && (
            <Card title="Your position">
              <ul className="space-y-1 text-sm">
                {holdings.map((h) => (
                  <li key={h.id} className="flex justify-between">
                    <span className="text-ink2">{h.account.name}: {Number(h.quantity.toString())} shares</span>
                    <span className="num">cost {money(cents(h.costBasis))}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AlertsCard alerts={alerts.filter((a) => a.symbol === symbol)} defaultSymbol={symbol} />
        <Card title="Related news">
          {news.length === 0 && articles.length === 0 ? (
            <p className="text-sm text-ink2">{md.news ? `No recent company news for ${symbol} from ${md.label.split(" (")[0]}.` : "Company news comes with a Finnhub market-data key."} Articles you save with the browser extension also appear here.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {news.map((n) => (
                <li key={n.url}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="text-ink hover:text-cyan">
                    {n.headline}
                  </a>
                  <p className="text-xs text-ink3">
                    {n.source} · {new Date(n.publishedAt).toLocaleDateString()} · via {md.label.split(" (")[0]}
                  </p>
                </li>
              ))}
              {articles.map((a) => (
                <li key={a.id}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="text-ink hover:text-cyan">
                    {a.title}
                  </a>
                  <p className="text-xs text-ink3">{a.publisher} · saved by you</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
