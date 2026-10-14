# Deploying VELTRIX (Vercel + Neon, free tiers)

1. **Database (Neon).** Create a project at https://neon.tech. In **Connect**, turn **Connection pooling off** and copy the connection string (`postgresql://…?sslmode=require`). Migrations need this direct connection.
2. **Website (Vercel).** At https://vercel.com, choose **Add New → Project**, import the GitHub repository and set **Root Directory** to `apps/web`. Add these environment variables:
   - `DATABASE_URL`: the Neon connection string
   - `APP_URL`: `https://<your-project>.vercel.app` (update it after the first deploy if the name differs)
   - `CRON_SECRET`: a random string of 16+ characters, for the daily job in `vercel.json`
   - `ENCRYPTION_KEY`: output of `openssl rand -base64 32`. Keep a copy; changing it later breaks linked banks and 2FA
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`: needed for sign-up verification and password resets. With Gmail: turn on 2-Step Verification, create an App Password at https://myaccount.google.com/apppasswords, and use `smtp.gmail.com`, port `587`, your Gmail address and that app password
   - `FINNHUB_API_KEY`: free key from https://finnhub.io/register, for real stock prices and company news
   - `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`: from https://dashboard.plaid.com/developers/keys. Sandbox uses test banks (`user_good` / `pass_good`); real banks need `PLAID_ENV=production` and Plaid's approval
   - optional: `AI_PROVIDER` / `AI_API_KEY`
3. Deploy. `vercel.json` runs `prisma generate && prisma migrate deploy && next build`, so the database schema is created automatically.
4. **Extension.** Rebuild it for the live address and reload it in `chrome://extensions`:
   `VELTRIX_API_URL=https://<your-project>.vercel.app npm run build:extension`

Notes:
- `npm run db:seed` only creates the built-in categories, so it's safe to run against production. The app also creates them when the first user registers.
- Vercel's Hobby plan is for personal, non-commercial use, and its cron jobs run once a day. Check current plan terms before launching commercially.
- Without SMTP settings in production, sign-up can't send verification emails, so new users can't get in. Set SMTP before sharing the link.
- Exchange rates come from Frankfurter (ECB) with no key. Check each provider's terms (Finnhub, Plaid, Frankfurter) before commercial use.
- The legal pages are drafts. Have them reviewed before a public launch.
