# API reference

All endpoints are JSON. Request bodies and query strings are validated with the zod schemas in `packages/shared/src/schemas.ts`.

**Errors** use the shape `{ "error": { "code", "message", "fields?" } }`:
- `422` — validation failure, with per-field messages
- `401` — unauthenticated
- `403` — wrong origin, token scope, or `email_unverified`
- `404` — not found, including other users' records
- `409` — conflict
- `429` — rate limited, with `Retry-After`

**Auth** column:
- **session**: `vx_session` cookie, plus an `Origin` header matching `APP_URL` on mutations
- **token**: `Authorization: Bearer vxt_…` with the `extension` scope
- **none**: public

| Endpoint | Methods | Auth | Notes |
|---|---|---|---|
| `/api/auth/register` | POST | none | `{name,email,password,acceptTerms,timezone?}` → sets session cookie, sends verification email → `{verificationRequired, emailSent}`. 5/hour/IP |
| `/api/auth/login` | POST | none | → `{user}` or `{mfaRequired:true}` (sets `vx_mfa`). 20/15 min/IP and 8/15 min/email; 423 while locked |
| `/api/auth/login/mfa` | POST | `vx_mfa` cookie | `{code}` (6-digit or recovery code) → session |
| `/api/auth/logout` | POST | session | Allowed while unverified |
| `/api/auth/verify-email` | POST | none | `{token}` |
| `/api/auth/resend-verification` | POST | session | Allowed while unverified |
| `/api/auth/forgot-password` | POST | none | `{email}`; always 200. 3/hour/email |
| `/api/auth/reset-password` | POST | none | `{token,password}`; signs out all sessions |
| `/api/settings/mfa` | GET POST | session | Status · start setup (QR + secret) |
| `/api/settings/mfa/enable`, `/disable`, `/recovery-codes` | POST | session | `{code}` · `{password,code}` · `{password}` |
| `/api/setup` | GET POST | session | Suggestions from linked data · save guided setup `{path, accounts[], monthlyIncome, budget[{category,limit}], goal}` |
| `/api/settings/dashboard` | GET PATCH | session | `{layout: widget[]}`, ordered visible widgets |
| `/api/advisor/actions/:id/apply`, `/dismiss` | POST | session | Apply or dismiss a proposed change. 409 if already handled or no longer valid, 410 if expired |
| `/api/plan/profile` | GET | session | Financial profile with sources, issues, commitments |
| `/api/plan/assumptions` | PATCH | session | Reserve months, returns, spending swing, essential categories, debt terms, excluded accounts (own accounts only) |
| `/api/plan/scenario` | POST | session | `{changes[], horizonMonths}` → baseline vs scenario, ranges, goal delays, drivers |
| `/api/plan/decision` | POST | session | `{label, priceCents, categorySlug?, alternative?, financing?, waitMonths?, usesPerMonth?}` → verdict, reasons, options |
| `/api/plan/stress` | POST | session | `{incomeLossMonths, incomeReplacementPct, emergencyCostCents, essentialIncreaseCents, discretionaryCutPct}` → runway, steps |
| `/api/plan/snapshots`, `/api/plan/snapshots/:id` | GET POST · GET DELETE | session | Saved plans; GET by id compares with actual results |
| `/api/banks` | GET | session | `{configured, items}` |
| `/api/banks/link-token` | POST | session | `{itemId?}` (update mode) → `{linkToken}` |
| `/api/banks/exchange` | POST | session | `{publicToken}` → links item, imports accounts and transactions |
| `/api/banks/:id`, `/api/banks/:id/sync` | DELETE · POST | session | Disconnect · sync now |
| `/api/accounts`, `/api/accounts/:id` | GET POST · PATCH DELETE | session | Balance updates record history points |
| `/api/categories` | GET | session | System + own categories |
| `/api/transactions` | GET POST | session | Query: `q, categoryId, accountId, from, to, min, max, type, page, pageSize` |
| `/api/transactions/:id` | GET PATCH DELETE | session | |
| `/api/transactions/import` | POST | session | `{filename, content, accountId?, invertSign?, dryRun?}` → counts, duplicates, line errors, preview |
| `/api/budgets?month=YYYY-MM`, `/api/budgets/:id` | GET POST · PATCH DELETE | session | Status with per-line health and projection |
| `/api/goals`, `/api/goals/:id` | GET POST · PATCH DELETE | session | Includes projections |
| `/api/goals/:id/contributions[/:cid]` | POST · DELETE | session | Negative amount = withdrawal |
| `/api/recurring?refresh=1`, `/api/recurring/:id` | GET · PATCH | session | `status: CONFIRMED / DISMISSED / SUSPECTED` |
| `/api/dashboard/spending?range=month\|3m\|12m` | GET | session | Breakdown + comparison + top merchants |
| `/api/insights?refresh=1`, `/api/insights/:id` | GET · PATCH | session | PATCH `{status: ACTIVE\|FOLLOWING\|DONE\|DISMISSED, outcome?}` |
| `/api/opportunities?refresh=1` | GET | session | Open + followed (ranked), 90-day history, muted kinds, possible savings (deduplicated) |
| `/api/opportunities/mute` | POST | session | `{kind, muted}` |
| `/api/memory` | GET POST DELETE | session | List (with master switch) · save a typed preference · forget everything |
| `/api/memory/:id` | PATCH DELETE | session | `{value?, enabled?}` · delete |
| `/api/memory/settings` | PATCH | session | `{enabled}` master switch |
| `/api/privacy` | GET | session | Data sources with live counts and status, outside services, permissions, things VELTRIX can't do, notification settings and held notifications, pending proposals and plans |
| `/api/privacy/history` | GET | session | Activity history `?group=security\|connections\|data\|advisor\|privacy&cursor=&limit=` |
| `/api/privacy/delete` | POST | session | `{source: extension_history\|advisor_conversations\|notifications}` delete one source's data |
| `/api/privacy/release` | POST | session | Show notifications held by quiet hours or a digest now |
| `/api/workflows` | GET POST | session | Outcome ledger (totals + entries) · start a plan `{recurringId, kind: cancel\|negotiate}` (returns the open one if it exists) |
| `/api/workflows/:id` | GET PATCH | session | Workflow with evidence, calculation and plan effect · `{checklist?, targetCents?, contactUrl?, notes?, draft?}` |
| `/api/workflows/:id/approve` | POST | session | Approve the prepared plan (409 at the wrong stage) |
| `/api/workflows/:id/action` | POST | session | `{date, newPriceCents?, note?}` report what you did, then verify |
| `/api/workflows/:id/verify` | POST | session | Re-check the outcome against later transactions (idempotent) |
| `/api/workflows/:id/abandon` | POST | session | Stop the plan |
| `/api/portfolio`, `/api/portfolio/performance?range=` | GET | session | Checks price alerts |
| `/api/holdings`, `/api/holdings/:id` | POST · DELETE | session | Investment/retirement accounts only |
| `/api/markets/search?q=`, `/api/markets/:symbol?range=` | GET | session | Data-source label included |
| `/api/watchlist`, `/api/watchlist/:id` | GET POST · DELETE | session or token | |
| `/api/alerts`, `/api/alerts/:id` | GET POST · DELETE | session | Max 50 active |
| `/api/products` | GET · POST | session or token · session | Saved products with observations, stats, verdict |
| `/api/products/:id`, `/api/products/:id/observations` | GET PATCH DELETE · POST | session | |
| `/api/deals`, `/api/deals/:id` | GET POST · DELETE | session | User-added deals are `USER_REPORTED` |
| `/api/rewards`, `/api/rewards/:id` | GET POST · PATCH DELETE | session | |
| `/api/articles`, `/api/articles/:id` | GET · DELETE | session | |
| `/api/trips` | GET · POST | session or token · session | |
| `/api/trips/:id`, `/api/trips/:id/expenses[/:eid]` | PATCH DELETE · POST DELETE | session | `isQuote` separates quotes from spend |
| `/api/fx?from=&to=` | GET | session | `rate: null` when no provider is configured |
| `/api/advisor/chat` | POST | session | `{conversationId?, message}` → `{conversationId, message{evidence, actions[]}, status}` |
| `/api/advisor/conversations[/:id]` | GET · GET DELETE | session | |
| `/api/reports?period=monthly\|yearly` | GET | session | |
| `/api/notifications` | GET POST | session | POST `{id}` or `{id:"all"}` marks read |
| `/api/search?q=` | GET | session | Transactions, instruments, goals, products, articles, insights, trips |
| `/api/settings/profile`, `/preferences`, `/consent`, `/password` | GET PATCH · PATCH · GET POST · POST | session | Preferences also take `notifyFrequency`, `quietHoursStart`/`quietHoursEnd` (both or neither), `notificationsPausedUntil`, `advisorProposals` |
| `/api/settings/sessions[/:id]`, `/api/settings/tokens/:id` | GET · DELETE | session | Sessions, extension tokens, audit events |
| `/api/settings/export?format=json\|csv` | GET | session | 10/hour |
| `/api/settings/demo` | DELETE | session | Remove legacy sample data |
| `/api/settings/delete-account` | POST | session | `{password, confirm:"DELETE"}` |
| `/api/extension/pairing-code` | POST | session | One live code per user, 10 minutes |
| `/api/ext/pair` | POST | none | `{code, deviceName}` → `{token, expiresAt}`. 10/15 min/IP |
| `/api/ext/me` | GET | token | Profile + consents |
| `/api/ext/analyze` | POST | token | Body: `PageExtraction` → `ExtensionAnalysis` |
| `/api/ext/save` | POST | token | `{kind: product\|article\|watchlist\|travel, …}` |
| `/api/ext/disconnect` | POST | token | Revokes the calling token |
| `/api/jobs/run` | POST | `Bearer $CRON_SECRET` | Alerts, bank sync and insights for all users |
| `/api/health` | GET | none | Database liveness |
