# VELTRIX — Your money. Supercharged.

VELTRIX is an AI-assisted personal finance platform. It has three parts:

- a **web app**: dashboard, a **What-if Lab** (financial profile, scenarios, purchase decisions, stress tests, saved plans compared with actual results), an **Opportunity Map** (ten areas with position, typed impact, effort, confidence, time to benefit, dependencies and a next step, ordered by your priorities), **Opportunities** (connected, ranked findings with evidence), **Financial memory** (preferences you choose to save, used by plans and the advisor), **Bills & Subscriptions** (plans to cancel or lower a recurring charge, verified against later transactions), an **Outcome Ledger** (identified vs. confirmed vs. realized savings), **Privacy & Permissions** (data by source, what VELTRIX may and can't do, pending decisions, notification frequency/quiet hours/pause, activity history), transactions, budgets, savings, goals, investments, markets research, deals, shopping, travel, reports and an AI advisor
- a **secure backend** with a PostgreSQL database
- a **Manifest V3 browser extension** that analyzes the page you're on (products, financial news, stock quotes, travel bookings) and saves what you find to the same account

Every figure is calculated by the application from your records, your linked bank accounts (Plaid) and live market data (Finnhub). Nothing is simulated: when a data source isn't configured, the app says so instead of inventing numbers. VELTRIX provides information and research, not financial advice. It never moves money, places trades or books travel.

```
apps/web         Next.js 15 app: UI, API routes, services, Prisma schema & migrations
apps/extension   Chrome/Edge MV3 extension (service worker, popup, options, on-demand extractor)
packages/shared  Shared TypeScript: zod API contracts, money & finance calculations, CSV parsing, page extraction
docs/            Architecture, API, deployment (DEPLOY.md) and product strategy (PRODUCT_STRATEGY.md)
```

## Quick start

Prerequisites: Node.js ≥ 20.11 and PostgreSQL 14+.

```bash
# 1. Install
npm install

# 2. Database (create a role and databases; adjust to your setup)
createuser -P veltrix            # password: veltrix (or update DATABASE_URL)
createdb -O veltrix veltrix
createdb -O veltrix veltrix_test # used by the test suite

# 3. Configure
cp apps/web/.env.example apps/web/.env

# 4. Apply migrations and load system categories
npm run db:deploy
npm run db:seed

# 5. Run
npm run dev                      # http://localhost:3000
```

Register an account at http://localhost:3000/register. You'll need to confirm your email: without SMTP settings, the verification link is printed in the terminal running `npm run dev`. New accounts start with a **guided setup**: connect a bank through Plaid, or enter balances, income, monthly spending and a goal step by step without sharing bank details. You can also import a CSV.

For production, set `ENCRYPTION_KEY` (`openssl rand -base64 32`) and SMTP settings. See [docs/DEPLOY.md](docs/DEPLOY.md).

## Browser extension

```bash
VELTRIX_API_URL=http://localhost:3000 npm run build:extension
```

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and select `apps/extension/dist`.
3. In VELTRIX, go to **Settings → Browser extension → Generate code**, then enter the code in the extension.
4. Visit a product page (try `http://localhost:3000/demo/store`), open the extension, and click **Save to wishlist**. The product appears under **Shopping**.

The extension's only host permission is the `VELTRIX_API_URL` origin it was built for. It reads a page only when you open its popup, via the browser's `activeTab` permission. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#browser-extension).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Web app in development mode |
| `npm run build` | Production build of the web app and the extension |
| `npm run db:deploy` / `db:migrate` | Apply migrations (deploy) / create a new migration (dev) |
| `npm run db:seed` | System categories (safe to run in production) |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint (web) |
| `npm test` | Unit + integration tests (shared, web against `veltrix_test`, extension) |
| `npm run test:e2e` | Playwright: web journey + loads the built extension in Chromium |

`npm run test:e2e` starts `next dev` if nothing is listening on :3000. Build the extension first. Set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium isn't at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Otherwise run `npx playwright install chromium` and point it there.

## Integrations

| Integration | Status without credentials | Configure |
|---|---|---|
| AI language model | Built-in deterministic analysis answers supported questions | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` (also needs the user's AI-processing consent) |
| Email | Messages printed to the server log (development only) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| Market data + company news | Prices shown as unavailable | `FINNHUB_API_KEY` (optional `ALPHA_VANTAGE_API_KEY` for history) |
| Currency exchange | On by default: ECB reference rates via Frankfurter, no key | `FX_PROVIDER=none` to turn off |
| Bank connections | Manual accounts + CSV import | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `ENCRYPTION_KEY` |
| Product price feeds | Not implemented: prices you observed via the extension or manually | Reserved (`PRICE_FEED_PROVIDER`) |
| Travel pricing | Not implemented: manual trips and quotes saved via the extension | Reserved (`TRAVEL_PROVIDER`) |

Settings → Integrations in the app shows the live status of each. No API is assumed to be free or licensed for commercial use. Check each provider's terms.

## Scheduled jobs

`POST /api/jobs/run` with `Authorization: Bearer $CRON_SECRET` evaluates price alerts, syncs linked banks and refreshes recurring-charge detection and insights for every user. Call it from your scheduler (e.g. hourly). Alerts and insights also refresh when users open the relevant pages.

## Testing

- **packages/shared** (84 tests): money arithmetic, net worth, spending, budgets, recurring detection, goals, portfolio returns, CSV parsing, page extraction (form fields never read, sensitive pages refused, scripts never executed), sanitization, password rules, the plan engine (projections, purchase decision rules, stress tests, goal timing, debt interest, financing), outcome verification (cancel and lower-price, data coverage, ledger buckets) merchant-descriptor matching, notification scheduling (digests, quiet hours across time zones, pause), and the opportunity map (unknowns stay unknown, typed impacts, priority ordering).
- **apps/web** (112 tests): route handlers called directly against PostgreSQL. Covers registration/login, email verification gating, password reset (single-use, no account enumeration), TOTP two-factor and recovery codes, lockout, rate limiting, CSRF origin rejection, logout invalidation, **cross-user isolation on every resource type**, CSV idempotency, budget maths, goals, net worth with FX conversion, the built-in advisor, extension pairing and token scopes, the Finnhub, Frankfurter and Plaid adapters and bank sync against mocked provider responses, guided setup, and advisor-proposed changes (plain-language parsing, apply-only-on-approval, expiry, cross-user refusal, re-validation at apply time), the financial profile (sources, fallbacks, missing data), what-if/decision/stress APIs, saved plans compared with actuals, the advisor answering what-if questions, the opportunity graph (connected rules, consolidation, deduplicated savings, follow/dismiss/mute, auto-resolve, privacy), and financial memory (phrase parsing, sensitive-data refusal, single-value replacement, privacy, master switch, effects on plans, advisor apply-to-save, export), and recurring-expense workflows (full cancel lifecycle from pending to confirmed, not-confirmed when charged again, measured price reduction, privacy, abandon, advisor ranking), and the privacy center (live source counts, owner-only data, advisor-proposal switch, pause/off/quiet hours/digests enforced, per-source deletion, paged and filtered history, a disclosure for every advisor tool), and the opportunity map (built from real data, recalculated from assumptions, priorities validated and private, goal kinds routed correctly, advisor 'where should I focus').
- **apps/extension** (6 tests): message validation (no open redirects) and the built extractor bundle, including the manifest's least-privilege permissions.
- **e2e** (7 tests, including the What-if Lab): landing page; register → verify email → account → transaction → budget → dashboard → advisor; guided manual setup → monthly plan → advisor proposes changes → apply → dashboard updates → purchase review → saved plan; password reset; redirect when signed out; and the real extension loaded in Chromium: pair → analyze the demo store → save → product visible in the web app.

## Known limitations

- Merchant price feeds and travel pricing need third-party providers and are not implemented. Their interfaces and UI states are in place.
- Plaid OAuth institutions (which need a registered redirect URI) and Plaid webhooks aren't wired up. Banks sync on the scheduled job and when the user clicks **Sync**.
- Rate limiting is stored in PostgreSQL, so it holds across serverless instances; very high traffic would want a dedicated store such as Redis.
- Authorization is enforced in the service layer (every query filters by the authenticated user, with tests), not with PostgreSQL row-level security.
- Holdings track quantity and total cost basis. Realized gains and tax lots aren't modeled; portfolio returns come from snapshots (value + net contributions).
- Foreign-currency balances are converted with ECB reference rates (daily, not live trading rates).
- Legal pages are drafts and need legal review. No regulatory approval or compliance is claimed.
- The extension targets Chromium (Chrome, Edge). Extraction, messaging and UI are separated so a Firefox build mainly needs a manifest variant (`browser_specific_settings`, background scripts) and the `browser.*` namespace; that build is not included.
