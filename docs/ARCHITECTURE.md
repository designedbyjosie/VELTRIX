# VELTRIX architecture

## Overview

```
┌──────────────────────┐   HTTPS (cookie session)   ┌──────────────────────────────────────┐
│ Web app (Next.js)    │ ─────────────────────────▶ │ API route handlers  (src/app/api)    │
│ Server Components ───┼── direct service calls ──▶ │   handler(): auth · CSRF · rate limit │
│ Client Components    │                            │            · zod validation · errors  │
└──────────────────────┘                            │ Services   (src/server/services)      │
┌──────────────────────┐   HTTPS (Bearer vxt_…)     │   every query scoped by userId        │
│ Extension (MV3)      │ ─────────────────────────▶ │ Providers  (market, FX, AI adapters)  │
│ service worker only  │                            │ Prisma ─▶ PostgreSQL                  │
└──────────────────────┘                            └──────────────────────────────────────┘
          ▲ chrome.runtime messages                  packages/shared: zod contracts, finance
┌─────────┴────────────┐                             maths, CSV parsing, page extraction —
│ popup / options      │                             used by web, API and extension alike
└──────────────────────┘
```

**Stack decisions.** The repository was empty, so the brief's default stack was used: Next.js 15 (App Router) with TypeScript, Tailwind CSS v4, Recharts, Prisma 6 on PostgreSQL, zod, and esbuild + React for the extension. Prisma 7 and Next 16 were available but were passed over for their more established predecessors. Authentication is implemented in-house (bcrypt + opaque hashed tokens). The model is small, and it keeps extension tokens and browser sessions under one auditable implementation.

## Money and calculations

- Money is `Decimal(18,2)` in the database with an explicit currency column. All arithmetic uses **integer cents** (`packages/shared/src/money.ts`), so sums never drift.
- Transactions are signed: negative means money out. Liabilities are stored as the positive amount owed.
- **Net worth** = assets − liabilities, base currency only. Foreign-currency accounts are counted and reported, never converted with a guessed rate.
- **Spending** excludes inflows and transfers (category kind `TRANSFER`).
- **Budgets** apply to a month when they are one-off for that month, or recurring and started on or before it, and not archived by then. Usage, warnings (per-line threshold) and month-end projection (daily pace) are pure functions.
- **Recurring detection** groups outflows by normalized merchant, checks interval regularity and amount stability, and stores **SUSPECTED** candidates. Only the user can mark one **CONFIRMED** or **DISMISSED**, and re-detection never overrides that choice.
- **Goal projections** assume no growth: required monthly amount = remaining ÷ months left.
- **Portfolio performance** separates *value change* from *market gain*. Gain = value change − net contributions, and return uses a simple Modified Dietz. Growth from deposits is never reported as profit.

## Data model

See `apps/web/prisma/schema.prisma`; each model carries a doc comment. Highlights:

- Every user-owned table has `userId` with cascade delete, indexed for its main access path.
- **Idempotent ingestion.** `Transaction.dedupeHash` is unique per user. CSV rows hash `(user, account, date, amount, merchant, occurrence-in-file)`, so re-importing a file inserts nothing, while two identical coffees in one file are both kept. `PriceObservation.observationKey` makes a same-day, same-price observation a no-op.
- **Traceability.** Records carry a `source` (`MANUAL`, `CSV`, `EXTENSION`, `PROVIDER`, `DEMO`, …), and CSV rows link to their `ImportBatch`.
- **Integrity migration** (`…_integrity_constraints`): a partial unique index for system categories, plus CHECK constraints (non-zero transaction amounts, positive limits/targets/prices, currency format, cashback range).
- **ConsentRecord** is append-only: the latest row per purpose is the user's current choice.
- **AuditEvent** records security-relevant events with a hashed IP.

## Security model

| Concern | Implementation |
|---|---|
| Passwords | bcrypt (cost 12). Constant-ish timing for unknown emails (dummy hash). |
| Sessions | 32-byte random token in an `HttpOnly; SameSite=Lax` cookie (`Secure` in production). Only the SHA-256 hash is stored. 30-day expiry, revocable per device, all other sessions revoked on password change. |
| CSRF | Cookie-authenticated mutations must carry an `Origin` matching `APP_URL`, on top of `SameSite=Lax`. |
| Authorization | Every service function takes the authenticated `userId` and filters by it, for reads and writes alike. Foreign IDs return 404, so they don't confirm another user's record exists. Covered by `test/isolation.test.ts`. |
| Extension tokens | Created only through a single-use, 10-minute pairing code. Hashed at rest, `extension` scope (refused on all other endpoints), 90-day expiry, revocable from Settings or the extension. |
| Validation | zod schemas from `packages/shared/src/schemas.ts` on every body and query. URLs must be http(s). Bodies are capped at 3 MB. |
| Rate limits | Login (per IP and per email), registration, pairing, CSV import, AI, search and export. |
| Headers | CSP, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production, `Cache-Control: no-store` on APIs. |
| Exports | CSV cells are protected against formula injection. |
| Secrets | Server-only env vars. Nothing secret is bundled into the client or the extension. |
| Deletion | Account deletion cascades through all user data. Audit events are detached rather than kept linked. |

Not implemented: email verification, password reset, MFA, PostgreSQL RLS, distributed rate limiting.

## AI advisor

`src/server/ai/`:

- **tools.ts** contains read-only tools such as `get_spending_summary`, `get_budget_status`, `get_goals`, `evaluate_purchase` and `compare_instruments`. Each validates its input with zod and is bound to the session's `userId` on the server; the model never supplies a user id. All numbers are computed by application code and returned with a provenance label (`user`, `observed`, `provider`, `demo`, `estimate`, `education`).
- **providers.ts** is the provider-independent adapter. Anthropic uses the official SDK (default `claude-opus-5-5`, `tool_choice: auto`, assistant turns appended unchanged across tool rounds). Any OpenAI-compatible endpoint is supported through `fetch`.
- **advisor.ts** routes each request:
  - **LLM mode** requires a configured provider *and* the user's `AI_PROCESSING` consent.
  - **Built-in mode** (`builtin.ts`) recognizes the supported question types, calls the same tools and fills templates. It runs when either requirement is missing or the provider fails, and the reply says which mode answered.
  - Messages are persisted with an evidence record (tools used, provenance, mode), and a per-user daily limit applies.
- **Prompt injection.** Article text from web pages is sent only with consent, wrapped in `<untrusted_page_content>` with tag-stripping, and summarized by a tool-less call. Page content never reaches the tool-using advisor.

**Insights** (`services/insights.ts`) are deterministic. Each stores what it is, why it matters, how it was calculated, its assumptions and the available action, and is labeled `POTENTIAL` vs `CONFIRMED`. Dismissals persist, stale insights are retired, and budget and goal warnings create notifications (respecting preferences).

## Browser extension

```
src/background.ts   service worker — the only holder of the API token; all backend calls
src/extractor.ts    bundled IIFE injected on demand; returns extractPage(document, location.href)
src/popup/          React popup (380px)
src/options/        React options page: pairing, privacy toggles, per-site disable list
static/manifest.template.json   host permission = VELTRIX_API_URL origin (set at build)
```

- **Permissions:** `activeTab`, `scripting` and `storage`, plus the single API origin. There are no content scripts, no `<all_urls>`, no `externally_connectable` and no web-accessible resources.
- **When it reads:** when the popup opens, or only after the button press if auto-analyze is off. The service worker injects the extractor into the active tab. Nothing happens in the background, and no browsing history is collected.
- **What it reads** (`packages/shared/src/extract`): public product metadata from JSON-LD, OpenGraph, microdata and an Amazon-specific display markup fallback; article headline, publisher and date; ticker symbols; travel structured data. Specifically:
  - never form-control values, cookies or storage
  - JSON-LD is parsed with `JSON.parse`; no page script is executed
  - checkout, cart, payment, login, account and banking pages (by path and by host) are refused before anything is read
  - every string is sanitized (control/bidi characters, tags, length caps); URLs are http(s) only and canonicalized
- **What it sends:** the extraction object, validated server-side by `pageExtractionSchema`. Article paragraphs are included only if the extension setting *and* the account consent are both on, and the server drops them otherwise.
- **Messaging:** only messages whose sender URL is this extension's origin are accepted, and each must match the `isRequest` shape. "Open" requests are restricted to `/app…` paths.
- **Rendering:** React text nodes only. Images are https-only with `no-referrer`.
- **Server side** (`services/extension.ts`):
  - analysis uses the user's saved products and observations, alternatives with the same GTIN or SKU at other merchants, the Shopping budget line and goals
  - a price verdict needs ≥ 3 recorded observations, so no history is ever invented
  - with `PRICE_TRACKING` consent, revisiting a saved product records its price
  - `BrowserAnalysis` logs only domain, page type and detected tickers

## Market data

`providers/market.ts` defines `MarketDataProvider` (`search`, `profile`, `quote`, `history`):

- **FinnhubProvider** (default when `FINNHUB_API_KEY` is set) serves quotes, symbol search, company profiles, company news and candles. When the plan doesn't include candles it falls back to Alpha Vantage history if a key is set. The key travels in a header, never in a URL.
- **NoMarketData** is the default without a key: prices are reported unavailable rather than simulated.
- **AlphaVantageProvider** maps the provider's endpoints defensively and caches responses.
- **DemoMarketProvider** (simulated, labeled demo) is used only when explicitly selected, e.g. by the test suite.

## Financial profile and plan engine

- **Profile** (`services/twin.ts`) assembles monthly income, essential and discretionary spending (last 3 full months of transactions, falling back to budget limits), cash, investments, debts with user-entered terms, goals and 30-day commitments. Each figure is a `Figure` with `source` (bank, imported, entered, budget, estimated, missing), `basis`, `asOf` and `stale`. It also returns a data-quality issue list. Planning assumptions live in `UserProfile.planningAssumptions` and are edited in the What-if Lab.
- **Engine** (`packages/shared/src/finance/scenario.ts`, `decision.ts`) is pure and deterministic. It does a monthly simulation with one-time, income, expense, extra-saving, extra-debt and financed-purchase changes; expected/best/adverse cases; plan comparison; driver attribution; stress-test changes and preparation steps; and the purchase decision rules. The server always builds the baseline itself, so clients only send changes.
- **Saved plans** (`PlanSnapshot`) store the baseline, assumptions, changes and projection, and are never modified. `comparePlanWithActual` reads balance history (`AccountBalance`), transactions and goal contributions for elapsed months, and re-projects goals from today's profile.
- **Advisor tools** `get_financial_profile`, `run_what_if`, `review_purchase` and `stress_test` call the same services. The built-in parser `ai/whatif.ts` maps common what-if phrasings onto them, and results link to `/app/plan`.
- **Extension:** product analyses include the purchase review (`product.decision`), computed with the same engine.

## Opportunity graph

`services/insights.ts` computes opportunities from accounts, transactions, recurring charges, budgets, goals, trips, saved products, articles, holdings and the financial profile. Each draft carries `links` (connected records), `confidence` and its basis, `eventDate`, evidence rows and `savingsParts`. `consolidate()` merges overlapping drafts (one card per event), and `rankOpportunity()` (shared, pure) scores them with a stored breakdown. `refreshInsights` upserts by `dedupeKey`, keeps user decisions (dismissed or done), reopens items whose condition returns, and marks items whose condition no longer holds as `RESOLVED`. `totalPotentialSavings` sums possible savings with each underlying record counted once. Muted kinds live in `UserPreference.mutedInsightKinds`. The UI is at `/app/opportunities`, and the dashboard shows the top items.

## Guided setup and dashboard layout

- `/app/setup` walks a new user through either path: **Connect my bank** (Plaid Link, then income, budget and goal, prefilled from the linked history via `GET /api/setup`) or **Enter it myself** (accounts, income with pay frequency, monthly spending per category, a goal). `POST /api/setup` saves everything at once and marks `onboardingCompletedAt`.
- The home dashboard renders widgets in the order stored in `UserProfile.dashboardLayout` (`packages/shared/src/dashboard.ts`; missing = hidden). Users reorder or hide them with **Customize dashboard** or by asking the advisor. The **Monthly plan** widget shows take-home income − budgeted spending − planned goal saving.

## Advisor-proposed changes

The advisor can update VELTRIX records and the dashboard, but only through proposals the user approves:

1. With an AI model, it calls `get_editable_items` then `propose_changes`. Without one, `ai/intents.ts` turns plain language ("my rent went up to $1,500", "I spent $42 on groceries yesterday", "hide investments from my dashboard") into the same change objects.
2. `services/advisor-actions.ts` validates each change against `advisorChangeSchema`, checks every referenced account/goal belongs to the user (bank-linked accounts can't be edited), and stores it as a `PROPOSED` `AdvisorAction` with a plain-language summary showing the current value. Nothing is changed.
3. The chat shows **Apply / Dismiss** per change. Applying claims the row atomically (no double-apply), re-validates against current data, performs the change through the normal services and writes an audit event. Proposals expire after 24 hours.

Supported changes: monthly income, manual account balance, new account, budget limit (add/remove category), new goal, goal target/date/monthly amount, goal contribution, manual transaction, dashboard widget show/hide/move. The advisor still cannot move money, trade or book anything.

## Exchange rates

`providers/fx.ts` fetches ECB reference rates from Frankfurter (no key) and caches them. Net worth converts foreign-currency balances into the user's base currency and shows the rates used.

## Bank connections (Plaid)

`providers/plaid.ts` is a thin client for `/link/token/create`, `/item/public_token/exchange`, `/accounts/get`, `/transactions/sync` and `/item/remove`; credentials go in headers. `services/banking.ts`:

- The browser opens Plaid Link with a short-lived link token; VELTRIX never sees bank credentials. The returned public token is exchanged server-side and the access token is stored encrypted (AES-256-GCM, `ENCRYPTION_KEY`).
- Sync follows the `/transactions/sync` cursor: added rows are inserted idempotently (`plaid:<transaction_id>` dedupe hash), modified rows update amounts but keep categories the user chose, removed rows are deleted, and pending transactions are skipped until they post.
- `ITEM_LOGIN_REQUIRED` marks the item for reconnection, which reopens Link in update mode.
- Disconnecting calls `/item/remove` and deletes the linked accounts and their transactions.

## Account security

- **Email verification:** sessions of unverified users are rejected (403 `email_unverified`) everywhere except logout and verification routes. Links are single-use hashed tokens valid for 24 hours.
- **Password reset:** single-use token valid for 1 hour; responses never reveal whether an email is registered; a reset signs out every session and sends an alert.
- **Two-factor (TOTP, RFC 6238):** secrets encrypted at rest, ±1 step tolerance, replay of a used step refused, 10 hashed single-use recovery codes. Login with 2FA issues a 5-minute challenge cookie (`vx_mfa`) with at most 5 attempts.
- **Lockout:** 10 failed passwords lock the account for 15 minutes. Passwords need 10+ characters and are checked against a common-password list.
- **Rate limits** live in PostgreSQL (`RateLimitBucket`, one atomic upsert per hit), so they hold across serverless instances.
- Instruments unknown to the provider can still be watchlisted, and are marked unverified.
