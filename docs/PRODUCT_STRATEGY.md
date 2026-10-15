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

### 7. Opportunity graph, built
- **Problem:** alert feeds show isolated, repetitive notices without saying how they relate or how sure they are.
- **Alternatives:** budget apps send budget, bill and subscription alerts separately; shopping tools alert on price drops without reference to the plan.
- **VELTRIX:** the existing recommendations became one structured model (`FinancialInsight`) with linked records, confidence and its basis, event date, last-verified time, evidence rows, next action, status (open, following, done, dismissed, resolved automatically) and outcome. New connected rules: a renewal landing in a category already over budget; recurring price increases; upcoming bills vs. cash; a trip that delays a goal (via the plan engine); a saved product's good price checked against the plan; saved research mentioning a holding or watchlist symbol. Overlapping cards are consolidated into one event, and possible savings are totaled with each underlying charge counted once. Ranking is base + impact + timing, × confidence, × a feedback factor that only counts recent dismissals of that kind. Each card shows this breakdown. Users can follow, dismiss with an outcome, mark done, or mute a kind.
- **Success metric:** share of opportunities marked "acted" vs. "not relevant"/"not accurate" per kind (used to tune or retire rules); possible savings acted on.

### 8. Financial memory, built
- **Problem:** assistants either forget everything between sessions or quietly build a profile the user can't see.
- **Alternatives:** general AI assistants offer memory, but it isn't tied to financial calculations, and inferred memories can be hard to inspect.
- **VELTRIX:** only items the user deliberately saves (`MemoryItem`): reserve target, savings milestones, budgeting method, research interests, spending priorities (important or flexible), planning caution, and free-text notes, with card numbers, IDs and passwords blocked. Each item can be edited, switched off or deleted; there's a master switch and "forget everything". Saved items change real calculations: the reserve target sets the plan's target, caution widens the spending range, flexible categories lead the stress-test steps, priorities are mentioned (never judged) in purchase reviews, and research tickers feed Opportunities. The advisor gets enabled items as context and can *propose* a memory, which the user applies. Each item shows when it was last used, and memory is included in the data export.
- **Success metric:** share of users with at least one enabled memory item; how often an item is switched off soon after it's applied (a sign of a poor suggestion).

### 9. Recurring-expense workflows and Outcome Ledger, built
- **Problem:** apps point out subscriptions and price increases, but nobody checks whether cancelling or negotiating actually happened, so "savings" are claimed rather than measured.
- **Alternatives:** bill-negotiation services take a cut of claimed savings; subscription trackers list charges but stop at the alert.
- **VELTRIX:** Bills & Subscriptions shows each recurring charge with evidence, price changes and a 60-day calendar. A plan to cancel or lower a price carries the evidence, yearly cost, effect on the user's plan, saved priorities, a checklist and an editable draft; the user approves it, acts, and reports the date. VELTRIX then verifies the result from later transactions and doesn't count missing data as proof. The Outcome Ledger keeps identified, planned, in progress, confirmed and realized amounts separate, and the advisor can rank recurring charges to lower.
- **Success metric:** confirmed annual savings and realized savings per active user; the share of plans that reach "confirmed" vs. "not confirmed".

### 10. Privacy & Permissions center, built
- **Problem:** finance apps bury what they collect and share; AI assistants rarely say what they can read or do.
- **Alternatives:** settings pages with consent toggles and a data export; activity logs limited to sign-ins.
- **VELTRIX:** one page, built from live data, showing each data source (counts, sync status, purpose, who else receives it, how to delete), outside services, the permissions with what the advisor can look up, what VELTRIX can't do and why, everything waiting for a decision (apply or dismiss in place), proactive-notification controls (frequency, digests, quiet hours, pause, held notifications) and a filterable activity history. The advisor's ability to propose changes can be switched off.
- **Success metric:** share of users who visit and change at least one setting; notification opt-outs vs. use of digests and quiet hours (a sign the volume is wrong).

### 11. Personal Opportunity Map, built
- **Problem:** suggestion feeds overwhelm, ignore what the user cares about, and mix guesses with facts.
- **Alternatives:** generic "financial health scores" and checklists that aren't tied to the user's own numbers.
- **VELTRIX:** ten areas built from the user's data, each with where they stand, a possible impact only when it can be calculated and labelled by type (possible savings, interest at stake, a gap to close), effort, confidence and why, time to benefit, what's missing, and one next step into an existing workflow. Users star up to three priorities (shown first, used by the advisor) and hide areas that aren't for them, and can compare areas side by side without implying amounts are additive or guaranteed.
- **Success metric:** share of users who set priorities; clicks on next steps per area; areas moving from "not enough data" to a known status.

## Next, in dependency order

1. **Autopilot scope:** the permissions center is built; any future automatic action must add its own permission there, off by default. per-capability toggles, pending actions and action history. It builds on the advisor-actions model (proposed → applied/dismissed, audited). The scope stays at read-only analysis and proposals; nothing moves money.
2. **Data-source status page:** connection health, last sync, permission scope and limitations for Plaid, Finnhub, FX and email. Partly present in Settings → Integrations and the profile issues list.
3. **Opportunity radar:** verified offers and price changes only, with source, date and eligibility. It needs merchant and travel price feeds (not configured), so it shows "possible" rather than "verified" until those exist.

## Dependencies still missing
- Plaid production approval (real bank data beyond sandbox) and Plaid webhooks.
- Merchant price, coupon and cashback feeds: no verified offers are shown without them.
- Travel price feeds.
- An AI provider key for free-form questions (the built-in analysis covers common phrasings).
