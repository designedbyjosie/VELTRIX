/**
 * Built-in deterministic advisor. Used when no language model is configured (or the
 * user hasn't consented to AI processing, or the provider fails). It recognizes the
 * supported question types, calls the same tools as the LLM, and formats answers
 * from templates — so every number shown is application-computed.
 */
import { runTool, type ToolContext } from "./tools";
import { parseChangeRequests } from "./intents";
import { editableItems } from "../services/advisor-actions";
import { todayIn } from "../dates";
import { parseWhatIf } from "./whatif";

export interface BuiltinAnswer {
  text: string;
  tools: { name: string; label: string; provenance: string[]; link?: { label: string; href: string } }[];
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
    used.push({ name, label: r.label, provenance: r.provenance, link: r.link });
    return r.data as Data;
  };

  // "What if" questions run the plan engine.
  const whatIf = parseWhatIf(question, Number(todayIn(ctx.timezone).slice(5, 7)));
  if (whatIf) {
    const projectionNote = "These are projections from your recent averages and saved assumptions, not predictions.";
    const gaps = (d: Data) => (d.canProject === false || d.confidence === "limited" ? ["", "To project this properly, VELTRIX needs your monthly income and spending. Add them in guided setup or tell me “I make $… a month”."] : []);
    if (whatIf.type === "profile") {
      const d = await call("get_financial_profile");
      const line = (label: string, f: Data, suffix = "") => bullet(`${label}: ${f.amount ?? "unknown"}${f.amount ? suffix : ""} (${f.source === "missing" ? "missing" : f.source === "entered" ? "you entered" : f.source === "bank" ? "bank sync" : f.source === "budget" ? "from your budget" : f.source === "imported" ? "your transactions" : "calculated"})`);
      return {
        text: [
          "Here's your financial picture:",
          line("Monthly income", d.monthlyIncome, "/mo"),
          line("Essential spending", d.essentialSpending, "/mo"),
          line("Discretionary spending", d.discretionarySpending, "/mo"),
          line("Left after spending", d.surplusBeforeGoals, "/mo"),
          line("Cash", d.cash),
          line("Debt", d.debt),
          d.reserveCoverageMonths !== null ? bullet(`Reserves cover ${d.reserveCoverageMonths} months of essentials (your target: ${d.reserveTargetMonths}).`) : "",
          ...(d.dataGaps.length ? ["", "To make this more accurate:", ...d.dataGaps.slice(0, 4).map(bullet)] : []),
        ].filter((x) => x !== "").join("\n"),
        tools: used,
      };
    }
    if (whatIf.type === "purchase") {
      const d = await call("review_purchase", { item: whatIf.label, price: whatIf.priceCents / 100, financing_months: whatIf.financing?.months, apr: whatIf.financing?.aprPercent, wait_months: whatIf.waitMonths });
      return {
        text: [
          `${d.verdict} — ${whatIf.label}:`,
          ...d.reasons.map(bullet),
          ...(d.fromSavedPreferences?.length ? ["", "From your saved preferences:", ...d.fromSavedPreferences.map(bullet)] : []),
          "",
          "Your options:",
          ...d.options.map((o: Data) => bullet(`${o.option}: lowest cash ${o.lowestCash}, net worth in 2 years ${o.netWorthIn2Years}${o.interest ? `, ${o.interest} interest` : ""}${o.goalEffects.length ? ` (${o.goalEffects.join("; ")})` : ""}`)),
          d.monthsToSaveFromSurplus ? `Saving your monthly surplus, you could pay cash in about ${d.monthsToSaveFromSurplus} month${d.monthsToSaveFromSurplus === 1 ? "" : "s"}.` : "",
          ...gaps(d),
          "It's your call. This shows trade-offs against the goals you've set, not a judgment.",
        ].filter((x) => x !== "").join("\n"),
        tools: used,
      };
    }
    if (whatIf.type === "scenario") {
      const d = await call("run_what_if", {
        changes: whatIf.changes.map((c) => ({
          kind: c.kind,
          label: c.label,
          amount: "amountCents" in c && c.amountCents !== undefined ? c.amountCents / 100 : undefined,
          percent: "percent" in c ? c.percent : undefined,
          start_month: "month" in c ? c.month : "startMonth" in c ? c.startMonth : 0,
          months: "months" in c ? c.months : undefined,
          bucket: "bucket" in c ? c.bucket : undefined,
          apr: "aprPercent" in c ? c.aprPercent : undefined,
        })),
      });
      if (d.error) return { text: "I couldn't model that change. Try the What-if Lab, where you can set it up step by step.", tools: used };
      const goalLines = d.goals.filter((g: Data) => g.monthsLater || g.lessSavedByEnd || g.nowMissesTargetDate).map((g: Data) => bullet(`${g.goal}: ${g.monthsLater ? `${g.monthsLater > 0 ? `${g.monthsLater} month(s) later` : `${-g.monthsLater} month(s) sooner`}` : g.lessSavedByEnd ? `${g.lessSavedByEnd} less saved by ${d.horizonEnds}` : ""}${g.nowMissesTargetDate ? " — would miss its target date" : ""}`));
      return {
        text: [
          `If ${whatIf.changes.map((c) => c.label.toLowerCase()).join(" and ")}, here's the projection to ${d.horizonEnds}:`,
          bullet(`Cash at the end: ${d.scenario.endCash} (vs ${d.currentPath.endCash} on your current path; range ${d.range.endCashAdverse}–${d.range.endCashBest} depending on spending)`),
          bullet(`Lowest point: ${d.scenario.lowestCash} in ${d.scenario.lowestCashMonth}${d.scenario.cashRunsOutMonth ? ` — cash would run out around ${d.scenario.cashRunsOutMonth}` : ""}`),
          bullet(`Net worth at the end: ${d.scenario.endNetWorth} (vs ${d.currentPath.endNetWorth})`),
          ...goalLines,
          ...gaps(d),
          projectionNote,
        ].join("\n"),
        tools: used,
      };
    }
    const d = await call("stress_test", { income_loss_months: whatIf.incomeLossMonths, income_replacement_pct: whatIf.incomeReplacementPct, unexpected_cost: whatIf.emergencyCostCents / 100, essential_increase_per_month: whatIf.essentialIncreaseCents / 100, discretionary_cut_pct: whatIf.discretionaryCutPct });
    return {
      text: [
        d.cashRunsOutMonth ? `In that situation, your cash would run out around ${d.cashRunsOutMonth}.` : "Your reserves would hold through that situation.",
        d.reservesCoverEssentialsWithNoIncomeMonths !== null ? bullet(`With no income at all, your cash covers about ${d.reservesCoverEssentialsWithNoIncomeMonths} months of essential spending.`) : "",
        bullet(`Lowest cash point: ${d.lowestCash}; the hard period costs about ${d.costVsNormalOver12Months} over 12 months compared with normal.`),
        d.goalsAffected.length ? bullet(`Goals affected: ${d.goalsAffected.join(", ")}`) : "",
        "",
        "How to prepare:",
        ...d.preparationSteps.slice(0, 4).map(bullet),
        ...gaps(d),
        "This is a hypothetical to help you prepare, not a prediction.",
      ].filter((x) => x !== "").join("\n"),
      tools: used,
    };
  }

  // Requests to change data or the dashboard become proposals the user can apply.
  if (ctx.propose) {
    const items = await editableItems(ctx.userId, ctx);
    const { changes, notes } = parseChangeRequests(question, {
      today: todayIn(ctx.timezone),
      accounts: items.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, linkedToBank: a.linkedToBank })),
      goals: items.goals.map((g) => ({ id: g.id, name: g.name, kind: g.kind })),
    });
    if (changes.length) {
      const r = await ctx.propose(changes);
      used.push({ name: "propose_changes", label: `Proposed ${r.proposed.length} change${r.proposed.length === 1 ? "" : "s"}`, provenance: ["user"] });
      const onlyMemory = changes.every((c) => c.action === "save_memory");
      const intro = onlyMemory ? "I'll remember this once you confirm. Click Apply to save it to your financial memory:" : "Here's what I'll change. Review each one and click Apply — nothing changes until you do:";
      const lines = r.proposed.length ? [intro, ...r.proposed.map((p) => bullet(p.summary))] : [];
      for (const x of r.rejected) lines.push(bullet(`Couldn't propose: ${x.reason}`));
      lines.push(...notes.map(bullet));
      return { text: lines.join("\n"), tools: used };
    }
    if (notes.length) return { text: notes.join("\n"), tools: used };
  }

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

  if (/\b(what do you (remember|know) about me|my (saved )?preferences|what('?s| is) in (my )?memory|what have i (told|asked) you to remember)\b/.test(q)) {
    const d = await call("get_memory");
    if (!d.memoryEnabled) return { text: "Financial memory is switched off, so I'm not using any saved preferences. You can turn it back on in Memory.", tools: used };
    if (!d.items.length) return { text: "You haven't saved any preferences yet. Try “Remember that my emergency fund target is 6 months” or “Travel matters to me”, and you'll confirm each one before it's saved.", tools: used };
    return { text: ["Here's what you've asked me to remember:", ...d.items.map((i: Data) => bullet(`${i.preference} (${i.type})`)), "You can edit, switch off or delete any of these in Memory."].join("\n"), tools: used };
  }

  if (/(opportunit|recommendation|what should i (look at|review|do|know)|anything i should|needs? my attention|what'?s (important|urgent))/.test(q)) {
    const d = (await call("get_insights")) as unknown as Data[];
    if (!d.length) return { text: "Nothing needs your attention right now. VELTRIX only surfaces something when it's backed by your data: renewals, price increases, upcoming bills, trips that affect goals, budget and goal alerts.", tools: used };
    return {
      text: [
        `Here ${d.length === 1 ? "is what" : `are the top ${Math.min(5, d.length)} things`} worth your attention:`,
        ...d.slice(0, 5).map((i) => bullet(`${i.title}${i.impact ? ` (${i.impact})` : ""}. ${i.why} Next: ${i.nextAction}.`)),
        "Each one shows its evidence, confidence and the records it connects on the Opportunities page.",
      ].join("\n"),
      tools: used,
    };
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
      "",
      "I can also update things for you (you'll confirm each change):",
      bullet("Set my food budget to $400"),
      bullet("My checking balance is $2,500"),
      bullet("I want to save $5,000 for a car by June 2027"),
      bullet("Hide investments from my dashboard"),
      "",
      "And explore decisions before you make them:",
      bullet("What if I buy a $1,500 laptop?"),
      bullet("What if my income drops 15%?"),
      bullet("Stress-test my finances if I lose my job for 3 months"),
    ].join("\n"),
    tools: used,
  };
}
