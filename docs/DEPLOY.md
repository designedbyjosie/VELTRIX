# Deploying VELTRIX (Vercel + Neon, free tiers)

1. **Database (Neon).** Create a project at https://neon.tech. In **Connect**, turn **Connection pooling off** and copy the connection string (`postgresql://…?sslmode=require`). Migrations need this direct connection.
2. **Website (Vercel).** At https://vercel.com, choose **Add New → Project**, import the GitHub repository and set **Root Directory** to `apps/web`. Add these environment variables:
   - `DATABASE_URL`: the Neon connection string
   - `APP_URL` (optional on Vercel): your public address, e.g. `https://<your-project>.vercel.app` or your own domain. Email links use it. If it's missing or still `localhost`, VELTRIX uses the production domain Vercel provides
   - `CRON_SECRET`: a random string of 16+ characters, for the daily job in `vercel.json`
   - `ENCRYPTION_KEY`: output of `openssl rand -base64 32`. Keep a copy; changing it later breaks linked banks and 2FA
   - `SMTP_USER` and `SMTP_PASS`: needed for sign-up verification and password resets. With Gmail: turn on 2-Step Verification, create an App Password at https://myaccount.google.com/apppasswords, then set `SMTP_USER` to your Gmail address and `SMTP_PASS` to the app password. The server (`smtp.gmail.com`) and sender are filled in automatically; set `SMTP_HOST` / `EMAIL_FROM` only for other providers or a custom sender. After adding variables, **redeploy**: Vercel only applies them to new deployments. Settings → Integrations in the app shows whether email is configured and which setting is missing
   - `FINNHUB_API_KEY`: free key from https://finnhub.io/register, for real stock prices and company news
   - `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`: from https://dashboard.plaid.com/developers/keys. Sandbox uses test banks (`user_good` / `pass_good`); real banks need `PLAID_ENV=production` and Plaid's approval
   - optional: `AI_PROVIDER` / `AI_API_KEY`
3. Deploy. `vercel.json` runs `prisma generate && prisma migrate deploy && next build`, so the database schema is created automatically.
4. **Extension.** Rebuild it for the live address and reload it in `chrome://extensions`:
   `VELTRIX_API_URL=https://<your-project>.vercel.app npm run build:extension`

Notes:
- `npm run db:seed` only creates the built-in categories, so it's safe to run against production. The app also creates them when the first user registers.
- **Test account with sample data (optional):** from your computer, run `DATABASE_URL="<your Neon connection string>" DEMO_PASSWORD="<a private password, 12+ characters>" npm run db:seed:demo`. It creates `demo@veltrix.app` (or `DEMO_EMAIL`) with email already confirmed and about 500 sample transactions, accounts, budgets, goals, trips and saved products, all labelled as demo data. Running it again refreshes the dates. A password is required for any non-local database so the account isn't open to anyone who reads these docs.
- Vercel's Hobby plan is for personal, non-commercial use, and its cron jobs run once a day. Check current plan terms before launching commercially.
- Without SMTP settings in production, sign-up can't send verification emails, so new users can't get in. Set SMTP before sharing the link.
- Exchange rates come from Frankfurter (ECB) with no key. Check each provider's terms (Finnhub, Plaid, Frankfurter) before commercial use.
- The legal pages are drafts. Have them reviewed before a public launch.
