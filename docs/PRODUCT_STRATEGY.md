# VELTRIX product strategy: decision intelligence

The question VELTRIX should answer better than anything else:

> "Given my actual financial situation, what's the smartest decision I can make right now, and what happens if I make it?"

This document records what we built toward that, how it compares with existing products, and what comes next. Competitor notes are based on publicly described features as of late 2026 and should be re-checked before any public claim. **We don't claim any capability is unique.** The aim is a connected experience that's hard to match with isolated features.

## Landscape (summary)

| Category | Examples | What they do well | Gap VELTRIX targets |
|---|---|---|---|
| Budget / tracking apps | Monarch, Copilot, YNAB, Rocket Money | Aggregation, categorization, budgets, recurring charges, some cash-flow forecasting | Mostly backward-looking. Decisions ("should I buy this now?") aren't modeled against goals with alternatives side by side. |
| Long-range planners | ProjectionLab, Boldin | Rich multi-decade scenarios, Monte Carlo, retirement | Heavy manual setup. Detached from day-to-day spending and from the moment a decision happens (a product page). |
| Shopping assistants | Honey, Capital One Shopping, Rakuten, price trackers | Coupons, price history, cashback at checkout | Optimize the price, not whether the purchase fits *your* plan. Some nudge more spending. |
| AI money chat | Cleo and assistants inside banking apps | Conversational access to balances and spending | Answers often lack visible calculations, assumptions and data provenance. |

## Differentiators, and what's built

### 1. Financial profile ("digital twin"), built
- **Problem:** every projection is only as good as its inputs, and users can't see what those inputs are.
- **Alternatives:** aggregators show balances; few explain where each planning number came from or flag stale or missing data.
- **VELTRIX:** `services/twin.ts` builds one profile (income, essential and discretionary spending, cash, investments, debt, goals, 30-day commitments). Every figure carries its **source** (bank sync, imported, user-entered, budget, calculated, missing), **freshness** and **basis**. Missing data stays missing. Users control which categories are essential, debt terms, reserve target, return and variance assumptions, and which accounts are used.
- **Success metric:** share of active users with `canProject = true`; number of data-quality issues resolved per user.

### 2. Counterfactual engine (What-if Lab), built
- **Problem:** people make decisions without seeing their consequences.
- **Alternatives:** long-range planners model scenarios but require heavy setup; budgeting apps rarely compare paths.
- **VELTRIX:** a deterministic monthly engine (`packages/shared/src/finance/scenario.ts`). It shows the current path versus the scenario, expected/best/adverse ranges, goal timing changes, debt payoff and interest, and attributes the difference to each driver. Changes are presets plus editable inputs, can be toggled and removed, and are reversible. All assumptions are shown.
- **Success metric:** scenarios run per active user per month; percentage of scenarios saved.

### 3. Decision engine ("Can I afford it?"), built
- **Problem:** "can I afford it?" is usually judged on balance alone.
- **Alternatives:** shopping tools optimize price; budget apps show remaining category budget.
- **VELTRIX:** compares *buy now / later / cheaper option / financed / skip* with the same assumptions. The verdict (**Fits your plan / Consider alternatives / Could put a goal at risk / Not enough data**) comes from explicit, documented rules, and every reason shows its numbers. The same review appears **in the browser extension on product pages**. Copy is non-judgmental, and the user's choice can be recorded.
- **Success metric:** percentage of reviews where the user records a choice; how often "later" or "cheaper" is chosen when the verdict isn't "fits".

### 4. Stress test, built
Income loss with partial replacement, emergency costs, essential-cost increases and discretionary cuts. Results show reserve runway, when cash would run out, goals affected, and prioritized preparation steps drawn from the user's own numbers. It's explicitly hypothetical.

### 5. Time machine (saved plans), built
Immutable snapshots of the baseline, assumptions, changes and projection. Later they're compared with actual balance history, income and spending: which assumptions held, what differed, and the goal date then versus now. Snapshots are never rewritten.
- **Success metric:** median absolute error of projected vs. actual month-end cash, shown per saved plan, as a public accuracy measure for the engine.

### 6. Command center, built (first version)
The advisor calls `get_financial_profile`, `run_what_if`, `review_purchase` and `stress_test`. Without an AI key, the built-in parser understands common what-if phrasings. Answers link to the full view in the What-if Lab, and data changes still require Apply (see advisor actions).

## Next, in dependency order

1. **Opportunity graph:** a structured `Opportunity` model (event, affected records, impact, confidence, evidence, last verified, next action, status/outcome). Rules connect existing signals: a recurring charge renewing while over budget, a price drop on a saved product when a goal milestone is reached, a trip conflicting with a debt target. Ranked by benefit × urgency × confidence, with deduplication so savings aren't double-counted.
2. **Financial memory:** saved preferences (budgeting method, priorities, uncertainty tolerance) the user can inspect, edit and disable. These are used by the advisor and the plan defaults. Planning assumptions already form the first part of this.
3. **Permissions center and autopilot:** per-capability toggles, pending actions and action history. It builds on the advisor-actions model (proposed → applied/dismissed, audited). The scope stays at read-only analysis and proposals; nothing moves money.
4. **Data-source status page:** connection health, last sync, permission scope and limitations for Plaid, Finnhub, FX and email. Partly present in Settings → Integrations and the profile issues list.
5. **Opportunity radar:** verified offers and price changes only, with source, date and eligibility. It needs merchant and travel price feeds (not configured), so it shows "possible" rather than "verified" until those exist.

## Dependencies still missing
- Plaid production approval (real bank data beyond sandbox) and Plaid webhooks.
- Merchant price, coupon and cashback feeds: no verified offers are shown without them.
- Travel price feeds.
- An AI provider key for free-form questions (the built-in analysis covers common phrasings).
