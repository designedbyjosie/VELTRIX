import { requireUser } from "@/server/current-user";
import { checkAlerts, getWatchlist, listAlerts } from "@/server/services/investments";
import { listArticles } from "@/server/services/articles";
import { marketData } from "@/server/providers/market";
import { PageHeader } from "@/components/page-header";
import { AlertsCard, ArticlesCard, InstrumentSearch, WatchlistCard } from "@/components/markets/markets-view";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Stocks & Trading" };

export default async function MarketsPage() {
  const user = await requireUser();
  await checkAlerts(user.id);
  const [watch, alerts, articles] = await Promise.all([getWatchlist(user.id), listAlerts(user.id), listArticles(user.id)]);
  const md = marketData();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Stocks & Trading"
        description={`Research instruments, track a watchlist and set price alerts. Market data: ${md.label}. VELTRIX does not place trades.`}
        actions={
          <LinkButton href="/app/advisor?q=Compare%20VOO%20and%20QQQ" variant="secondary" size="sm">
            Compare with AI
          </LinkButton>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <InstrumentSearch />
        <WatchlistCard items={watch.items} />
        <AlertsCard alerts={alerts} />
      </div>
      <ArticlesCard articles={articles} />
    </div>
  );
}
