# Deploying VELTRIX (Vercel + Neon, free tiers)

1. **Database (Neon).** Create a project at https://neon.tech. In **Connect**, turn **Connection pooling off** and copy the connection string (`postgresql://…?sslmode=require`). Migrations need this direct connection.
2. **Website (Vercel).** At https://vercel.com, choose **Add New → Project**, import the GitHub repository and set **Root Directory** to `apps/web`. Add these environment variables:
   - `DATABASE_URL`: the Neon connection string
   - `APP_URL`: `https://<your-project>.vercel.app` (update it after the first deploy if the name differs)
   - `CRON_SECRET`: a random string of 16+ characters, for the daily job in `vercel.json`
   - optional: `AI_PROVIDER` / `AI_API_KEY`, `MARKET_DATA_PROVIDER` / `ALPHA_VANTAGE_API_KEY`
3. Deploy. `vercel.json` runs `prisma generate && prisma migrate deploy && next build`, so the database schema is created automatically.
4. **Extension.** Rebuild it for the live address and reload it in `chrome://extensions`:
   `VELTRIX_API_URL=https://<your-project>.vercel.app npm run build:extension`

Notes:
- Don't run `npm run db:seed` against a public deployment. It creates a demo login with a published password. People can register, then load labeled demo data from Settings.
- Vercel's Hobby plan is for personal, non-commercial use, and its cron jobs run once a day. Check current plan terms before launching commercially.
- Rate limiting is in-memory per serverless instance; add a shared store before real launch. Email verification, password reset and MFA aren't implemented yet, so don't put real financial data in a public deployment until they are.
