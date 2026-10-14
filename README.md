# VELTRIX — Your money. Supercharged.

VELTRIX is an AI-assisted personal finance platform. It has three parts:

- a **web app**: dashboard, transactions, budgets, savings, goals, investments, markets research, deals, shopping, travel, reports and an AI advisor
- a **secure backend** with a PostgreSQL database
- a **Manifest V3 browser extension** that analyzes the page you're on (products, financial news, stock quotes, travel bookings) and saves what you find to the same account

Every figure is calculated by the application from your records. Demo data and simulated market prices are labeled wherever they appear. VELTRIX provides information and research, not financial advice. It never moves money, places trades or books travel.

```
apps/web         Next.js 15 app: UI, API routes, services, Prisma schema & migrations
apps/extension   Chrome/Edge MV3 extension (service worker, popup, options, on-demand extractor)
packages/shared  Shared TypeScript: zod API contracts, money & finance calculations, CSV parsing, page extraction
docs/            Architecture, API and security notes
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

# 4. Apply migrations and load the demo account
npm run db:deploy
npm run db:seed

# 5. Run
npm run dev                      # http://localhost:3000
```

Sign in with the seeded demo account: **demo@veltrix.app / veltrix-demo-2026**. Change `SEED_DEMO_PASSWORD` anywhere other than local development. Or register a new account, which starts empty with an option to load labeled demo data.

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
| `npm run db:seed` | System categories, demo instruments and the demo user |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint (web) |
| `npm test` | Unit + integration tests (shared, web against `veltrix_test`, extension) |
| `npm run test:e2e` | Playwright: web journey + loads the built extension in Chromium |

`npm run test:e2e` starts `next dev` if nothing is listening on :3000. Build the extension first. Set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium isn't at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Otherwise run `npx playwright install chromium` and point it there.

## Integrations

| Integration | Status without credentials | Configure |
|---|---|---|
| AI language model | Built-in deterministic analysis answers supported questions | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` (also needs the user's AI-processing consent) |
| Market data | Simulated prices labeled "demo data" | `MARKET_DATA_PROVIDER=alphavantage`, `ALPHA_VANTAGE_API_KEY` |
| Currency exchange | Conversion unavailable; foreign-currency accounts are excluded from totals | `FX_PROVIDER=frankfurter` |
| Bank aggregation | Not implemented: manual accounts + CSV import | Adapter interface reserved (`AGGREGATOR_PROVIDER`) |
| Financial news | Not implemented: articles saved via the extension | Reserved (`NEWS_PROVIDER`) |
| Product price feeds | Not implemented: prices you observed via the extension or manually | Reserved (`PRICE_FEED_PROVIDER`) |
| Travel pricing | Not implemented: manual trips and quotes saved via the extension | Reserved (`TRAVEL_PROVIDER`) |

Settings → Integrations in the app shows the live status of each. No API is assumed to be free or licensed for commercial use. Check each provider's terms.

## Scheduled jobs

`POST /api/jobs/run` with `Authorization: Bearer $CRON_SECRET` evaluates price alerts and refreshes recurring-charge detection and insights for every user. Call it from your scheduler (e.g. hourly). Alerts and insights also refresh when users open the relevant pages.

## Testing

- **packages/shared** (44 tests): money arithmetic, net worth, spending, budgets, recurring detection, goals, portfolio returns, CSV parsing, page extraction (form fields never read, sensitive pages refused, scripts never executed), sanitization.
- **apps/web** (26 tests): route handlers called directly against PostgreSQL. Covers registration/login, rate limiting, CSRF origin rejection, logout invalidation, **cross-user isolation on every resource type**, category ownership, auto-categorization, CSV idempotency, filters, budget maths, goals, net worth, the built-in advisor, extension pairing (single-use codes, hashed tokens), token scope limits, revocation, payload validation, consent-gated article text and the product save flow.
- **apps/extension** (6 tests): message validation (no open redirects) and the built extractor bundle, including the manifest's least-privilege permissions.
- **e2e** (5 tests): landing page; register → account → transaction → budget → dashboard → advisor; redirect when signed out; and the real extension loaded in Chromium: pair → analyze the demo store → save → product visible in the web app.

## Known limitations

- Bank connections, live news, merchant price feeds and travel pricing need third-party providers and are not implemented. Their interfaces and UI states are in place.
- Rate limiting is in-memory (per instance). Use a shared store such as Redis for multi-instance deployments.
- Authorization is enforced in the service layer (every query filters by the authenticated user, with tests), not with PostgreSQL row-level security.
- Holdings track quantity and total cost basis. Realized gains and tax lots aren't modeled; portfolio returns come from snapshots (value + net contributions).
- Foreign-currency balances are excluded from totals unless an FX provider is configured.
- Email verification, password reset and multi-factor authentication are not implemented yet.
- Legal pages are drafts and need legal review. No regulatory approval or compliance is claimed.
- The extension targets Chromium (Chrome, Edge). Extraction, messaging and UI are separated so a Firefox build mainly needs a manifest variant (`browser_specific_settings`, background scripts) and the `browser.*` namespace; that build is not included.
