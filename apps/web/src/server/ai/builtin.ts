/**
 * Built-in deterministic advisor. Used when no language model is configured (or the
 * user hasn't consented to AI processing, or the provider fails). It recognizes the
 * supported question types, calls the same tools as the LLM, and formats answers
 * from templates — so every number shown is application-computed.
 */
import { runTool, type ToolContext } from "./tools";

export interface BuiltinAnswer {
  text: string;
  tools: { name: string; label: string; provenance: string[] }[];
}

// Tool payloads are loosely typed JSON produced by tools.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;

const TICKER = /\$?\b([A-Z]{1,5})\b/g;
const STOP = new Set(["I", "A", "AI", "ETF", "ETFS", "VS", "OR", "AND", "THE", "MY", "IS", "HOW", "WHAT", "USD", "OK", "DO", "CAN", "IT", "TO", "IN", "ON", "OF", "ME", "IF"]);

function tickers(q: string): string[] {
  const out: string[] = [];
  for (const m of q.matchAll(TICKER)) if (!STOP.has(m[1]) && !out.includes(m[1])) out.push(m[1]);
  return out;
}

const bullet = (s: string) => `• ${s}`;

export async function builtinAnswer(ctx: ToolContext, question: string): Promise<BuiltinAnswer> {
  const q = question.toLowerCase();
  const used: BuiltinAnswer["tools"] = [];
  const call = async (name: string, input: unknown = {}) => {
    const r = await runTool(ctx, name, input);
    used.push({ name, label: r.label, provenance: r.provenance });
    return r.data as Data;
  };

  const amountMatch = question.match(/\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/);
  const syms = tickers(question);

  // Purchase impact
  if (/(afford|purchase|buy|spend)\b/.test(q) && amountMatch && !/stock|share|etf/.test(q)) {
    const amount = `${amountMatch[1].replace(/,/g, "")}.${(amountMatch[2] ?? "00").padEnd(2, "0")}`;
    const d = await call("evaluate_purchase", { amount });
    const lines = [`Here's how a ${d.amount} purchase fits this month:`];
    if (d.budget?.category) {
      lines.push(bullet(`${d.budget.category} budget: ${d.budget.remainingBefore} left now, ${d.budget.remainingAfter} after the purchase (${d.budget.percentOfLimitAfter}% of the limit). ${d.budget.fitsWithinBudget ? "It fits within the budget." : "It would put you over budget."}`));
    } else lines.push(bullet(d.budget?.note ?? "No matching budget found."));
    if (d.goal) lines.push(bullet(`It equals ${d.goal.purchaseAsPercentOfRemaining}% of what's left for "${d.goal.name}" (${d.goal.remaining})${d.goal.monthsOfPlannedSaving !== null ? `, or about ${d.goal.monthsOfPlannedSaving} months of your planned contributions` : ""}.`));
    lines.push("These figures use your recorded budgets and goals; they don't include upcoming bills.");
    return { text: lines.join("\n"), tools: used };
  }

  // Instrument comparison / lookup
  if (syms.length >= 2 && /(compare|vs|versus|difference|better)/.test(q)) {
    const rows = (await call("compare_instruments", { symbols: syms.slice(0, 4) })) as unknown as Data[];
    const lines = [`Comparison of ${syms.slice(0, 4).join(", ")} (computed from ${rows[0]?.dataSource ?? "market data"}):`];
    for (const r of rows) {
      if (r.error) {
        lines.push(bullet(`${r.symbol}: ${r.error}`));
        continue;
      }
      lines.push(
        bullet(
          `${r.symbol} — ${r.name} (${r.type ?? "?"}${r.sector ? `, ${r.sector}` : ""}). 1-year price return ${r.oneYearReturnPercent ?? "n/a"}%, volatility ${r.annualizedVolatilityPercent ?? "n/a"}%, max drawdown ${r.maxDrawdownPercent ?? "n/a"}%${r.expenseRatioPercent != null ? `, expense ratio ${r.expenseRatioPercent}%` : ""}${r.dividendYieldPercent != null ? `, dividend yield ~${r.dividendYieldPercent}%` : ""}.`,
        ),
      );
    }
    if (rows.some((r) => r.isDemo)) lines.push("⚠ These are simulated demo prices, not real market data.");
    lines.push("Past performance doesn't predict future returns. Broad index funds spread risk across many companies; single stocks concentrate it. This is educational information, not a recommendation.");
    return { text: lines.join("\n"), tools: used };
  }
  if (syms.length === 1 && /(stock|etf|share|price|about|research|tell me|how is|what is|summar|risk)/.test(q)) {
    const r = await call("get_instrument", { symbol: syms[0] });
    if (r.error) return { text: r.error, tools: used };
    const lines = [
      `${r.symbol} — ${r.name}${r.sector ? ` (${r.sector})` : ""}`,
      r.description ? r.description : "",
      bullet(`Last price: ${r.price ?? "n/a"} ${r.currency ?? ""}${r.asOf ? ` as of ${new Date(r.asOf).toUTCString()}` : ""}${r.isDemo ? " — demo data" : " (delayed)"}`),
      bullet(`1-year price change: ${r.oneYearReturnPercent ?? "n/a"}%; annualized volatility ${r.annualizedVolatilityPercent ?? "n/a"}%; largest drop from a peak ${r.maxDrawdownPercent ?? "n/a"}%.`),
      "Risks to consider: company- or sector-specific events, valuation changes and market-wide downturns. Past performance doesn't predict future returns.",
    ];
    return { text: lines.filter(Boolean).join("\n"), tools: used };
  }

  if (/(subscription|recurring|cancel)/.test(q)) {
    const d = await call("get_recurring_payments");
    if (!d.items.length) return { text: "I haven't found recurring charges yet. Detection needs at least three months of transactions with the same merchant and a similar amount.", tools: used };
    const lines = [`I found ${d.items.length} recurring charges, about ${d.estimatedAnnualTotal} a year in total:`, ...d.items.slice(0, 8).map((i: Data) => bullet(`${i.merchant}: ${i.amount} ${i.frequency.toLowerCase()} → ${i.estimatedAnnual}/yr${i.status === "SUSPECTED" ? " (inferred, not yet confirmed)" : ""}`))];
    lines.push("Potential saving = the annual cost of any you cancel. Review them on the Savings page to confirm or dismiss each one.");
    return { text: lines.join("\n"), tools: used };
  }

  if (/(budget|over ?spend|limit)/.test(q)) {
    const d = (await call("get_budget_status")) as unknown as Data[];
    if (!d.length) return { text: "You don't have a budget for this month yet. Create one on the Budgets page to track spending against limits.", tools: used };
    const lines: string[] = [];
    for (const b of d) {
      lines.push(`${b.budget}: ${b.spent} of ${b.limit} spent, ${b.remaining} remaining (projected ${b.projectedMonthEnd} by month end).`);
      const flagged = b.categories.filter((c: Data) => c.status !== "ok");
      if (flagged.length) lines.push(...flagged.map((c: Data) => bullet(`${c.category}: ${c.spent} of ${c.limit} (${c.percentUsed}%) — ${c.status === "over" ? "over budget" : "approaching the limit"}`)));
      else lines.push(bullet("Every category is within its limit."));
    }
    return { text: lines.join("\n"), tools: used };
  }

  if (/(goal|emergency|saving for|on track|vacation|house|car)/.test(q)) {
    const d = (await call("get_goals")) as unknown as Data[];
    if (!d.length) return { text: "You haven't set any savings goals yet. Create one on the Goals page and I'll track progress and the monthly amount needed.", tools: used };
    const lines = d.map((g) =>
      bullet(
        `${g.name}: ${g.saved} of ${g.target} (${g.percent}%).${g.requiredMonthly ? ` Needs ${g.requiredMonthly}/month to reach it by ${g.targetDate}.` : ""}${g.plannedMonthly ? ` You plan ${g.plannedMonthly}/month.` : ""} ${g.onTrack === true ? "On track." : g.onTrack === false ? "Behind schedule." : ""}`,
      ),
    );
    lines.push("Projections assume no interest or investment growth.");
    return { text: lines.join("\n"), tools: used };
  }

  if (/(net worth|worth|assets|liabilit|debt|accounts?)\b/.test(q)) {
    const d = await call("get_net_worth");
    const lines = [`Your net worth is ${d.netWorth}: ${d.assets} in assets minus ${d.liabilities} in liabilities.`, ...d.accounts.slice(0, 10).map((a: Data) => bullet(`${a.name} (${a.type.toLowerCase().replace("_", " ")}): ${a.balance}${a.isLiability ? " owed" : ""}`))];
    if (d.excludedForeignCurrencyAccounts) lines.push(`${d.excludedForeignCurrencyAccounts} foreign-currency account(s) are excluded because no exchange-rate source is configured.`);
    return { text: lines.join("\n"), tools: used };
  }

  if (/(portfolio|investment|holding|allocation|diversif)/.test(q)) {
    const d = await call("get_portfolio");
    if (!d.holdings.length) return { text: "You don't have any holdings recorded. Add them on the Investments page.", tools: used };
    return {
      text: [
        `Your holdings are worth ${d.marketValue} against a cost basis of ${d.costBasis}, an unrealized gain of ${d.unrealizedGain}${d.unrealizedGainPercent !== null ? ` (${d.unrealizedGainPercent}%)` : ""}.`,
        bullet(`Largest position: ${d.largestPositionPercent}% of the portfolio; overall concentration: ${d.concentration}.`),
        bullet(`By type: ${d.allocationByType.map((a: Data) => `${a.key} ${a.percent}%`).join(", ")}`),
        `Prices: ${d.priceSource}. Unrealized gains aren't profit until sold, and contributions are not returns.`,
      ].join("\n"),
      tools: used,
    };
  }

  if (/(trip|travel|vacation|flight|hotel)/.test(q)) {
    const d = (await call("get_trips")) as unknown as Data[];
    if (!d.length) return { text: "You haven't saved any trips. Add one on the Travel page to track its budget and expenses.", tools: used };
    return { text: ["Your trips:", ...d.map((t) => bullet(`${t.name} (${t.destination}): ${t.spent} spent + ${t.savedQuotes} in saved quotes = ${t.projectedTotal} projected${t.budget ? ` against a ${t.budget} budget` : ""}.`))].join("\n"), tools: used };
  }

  if (/(product|wishlist|price|deal|competitive|cheaper)/.test(q)) {
    const d = (await call("get_saved_products")) as unknown as Data[];
    if (!d.length) return { text: "You haven't saved any products yet. Use the VELTRIX browser extension on a product page to save it and start tracking its price.", tools: used };
    return { text: ["Your saved products:", ...d.slice(0, 8).map((p) => bullet(`${p.title.slice(0, 60)} — ${p.latestPrice ?? "no price"} at ${p.merchant}. ${p.verdict}${p.observations ? ` (${p.observations} recorded prices, average ${p.average})` : ""}.`)), "Verdicts compare against prices you've recorded, not a market-wide history."].join("\n"), tools: used };
  }

  if (/(spen|money go|where did|categor|expens|this month|last month)/.test(q)) {
    const range = /(year|12)/.test(q) ? "12m" : /(3 months|three months|quarter)/.test(q) ? "3m" : "month";
    const d = await call("get_spending_summary", { range });
    if (!d.categories.length) return { text: "I don't see any spending recorded for this period. Add transactions or import a CSV to get started.", tools: used };
    const change = d.changePercent === null ? "" : ` That's ${Math.abs(d.changePercent)}% ${d.changePercent >= 0 ? "more" : "less"} than ${d.comparison.replace("vs. ", "")}.`;
    return {
      text: [`You spent ${d.total} (${d.period}).${change}`, ...d.categories.slice(0, 8).map((c: Data) => bullet(`${c.category}: ${c.amount} (${c.percentOfTotal}%)${c.topMerchants.length ? ` — mostly ${c.topMerchants.slice(0, 2).join(", ")}` : ""}`)), "Transfers between your own accounts are excluded."].join("\n"),
      tools: used,
    };
  }

  return {
    text: [
      "I can answer questions about your VELTRIX data. Try:",
      bullet("Where did my money go this month?"),
      bullet("Which categories are over budget?"),
      bullet("How much could I save by cancelling subscriptions?"),
      bullet("How am I progressing toward my emergency fund?"),
      bullet("Compare VOO and QQQ"),
      bullet("Can I afford a $350 purchase?"),
      bullet("What's my net worth?"),
    ].join("\n"),
    tools: used,
  };
}
