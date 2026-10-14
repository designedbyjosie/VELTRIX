import { Suspense } from "react";
import { requireUser } from "@/server/current-user";
import { listAccounts, netWorthHistory, netWorthNow } from "@/server/services/accounts";
import { plaidConfigured } from "@/server/providers/plaid";
import { BankConnections } from "@/components/overview/bank-connections";
import { addDays, todayIn } from "@/server/dates";
import { AccountsManager } from "@/components/overview/accounts-manager";
import { AreaTrend } from "@/components/charts";
import { Card, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Financial overview" };

export default async function OverviewPage() {
  const user = await requireUser();
  const [nw, accounts, history] = await Promise.all([netWorthNow(user.id, user.baseCurrency), listAccounts(user.id), netWorthHistory(user.id, user.baseCurrency, addDays(todayIn(user.timezone), -400))]);
  const byType = new Map<string, number>();
  for (const a of accounts.filter((x) => x.currency === user.baseCurrency)) byType.set(a.type, (byType.get(a.type) ?? 0) + a.balanceCents);
  return (
    <div className="space-y-5">
      <PageHeader title="Financial overview" description="Your complete position: every account, what you own, what you owe." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card title="Net worth">
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-ink3">Net worth</p>
              <p className="num font-display text-2xl font-semibold">{money(nw.netWorthCents, user.baseCurrency)}</p>
            </div>
            <div>
              <p className="text-xs text-ink3">Assets</p>
              <p className="num text-lg text-ink">{money(nw.assetsCents, user.baseCurrency)}</p>
            </div>
            <div>
              <p className="text-xs text-ink3">Liabilities</p>
              <p className="num text-lg text-neg">{money(nw.liabilitiesCents, user.baseCurrency)}</p>
            </div>
          </div>
          {history.length >= 2 ? (
            <AreaTrend data={history.map((h) => ({ date: h.date, value: h.netWorthCents }))} color="#39D9FF" currency={user.baseCurrency} valueLabel="Net worth" height={220} />
          ) : (
            <EmptyState title="History builds as you update balances" body="Each balance update records a point in time, so your net worth trend appears after the second update." />
          )}
          <p className="mt-2 text-[11px] text-ink3">
            Net worth = assets − liabilities. Liabilities are entered as the amount owed.
            {nw.fxRates.length > 0 && ` Converted to ${user.baseCurrency}: ${nw.fxRates.map((r) => `1 ${r.from} = ${r.rate} ${r.to}`).join(", ")} (ECB reference rate, ${nw.fxRates[0].asOf}).`}
            {nw.excludedForeignCurrency ? ` ${nw.excludedForeignCurrency} foreign-currency account(s) are excluded because no exchange rate was available.` : ""} The trend chart covers ${user.baseCurrency} accounts.
          </p>
        </Card>
        <div className="space-y-4">
          <Card title="By account type">
            {byType.size === 0 ? (
              <p className="text-sm text-ink2">No accounts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...byType.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                  <li key={t} className="flex justify-between">
                    <span className="text-ink2">{t.replace(/_/g, " ").toLowerCase().replace(/^\w/, (x) => x.toUpperCase())}</span>
                    <span className="num">{money(c, user.baseCurrency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Bank connections">
            <BankConnections configured={plaidConfigured()} />
          </Card>
        </div>
      </div>
      <Suspense>
        <AccountsManager accounts={accounts} />
      </Suspense>
    </div>
  );
}
