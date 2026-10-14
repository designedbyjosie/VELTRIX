import Link from "next/link";
import { ArrowRight, BadgePercent, ChartCandlestick, ChartLine, Check, Layers, Lock, MonitorSmartphone, PiggyBank, Plane, ShieldCheck, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { getCurrentUser } from "@/server/current-user";
import { VeltrixMark } from "@/components/logo";
import { DashboardPreview, ExtensionPreview } from "@/components/landing/previews";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: ChartCandlestick, title: "Stocks & Trading", body: "Research tickers, watchlists and price alerts — with sources and timestamps on every number." },
  { icon: ChartLine, title: "Investing", body: "Allocation, concentration and returns that separate market gains from your own deposits." },
  { icon: PiggyBank, title: "Saving Money", body: "Find recurring charges, size an emergency fund, and see how fast each goal can be reached." },
  { icon: ShoppingBag, title: "Shopping", body: "Track the prices you actually see and know whether a “deal” is one before you buy." },
  { icon: Plane, title: "Travel", body: "Trip budgets that count both what you've spent and the quotes you're considering." },
  { icon: Wallet, title: "Financial Management", body: "Transactions, budgets and reports built on your own records, with CSV import." },
  { icon: Sparkles, title: "AI Financial Advisor", body: "Ask about your money in plain language. Answers cite the data they used." },
];

const FAQ = [
  { q: "Does VELTRIX need my bank password?", a: "No. You can add accounts manually and import CSV statements. Automatic bank connections require an account-aggregation provider's official consent flow, which VELTRIX would use instead of ever asking for your credentials." },
  { q: "Is this financial advice?", a: "No. VELTRIX provides information, calculations and research tools. It doesn't guarantee returns, place trades or make decisions for you." },
  { q: "Where do the numbers come from?", a: "Totals, budgets, projections and comparisons are calculated by VELTRIX from your records. Market prices come from the configured data provider, and demo data is always labeled as demo data." },
  { q: "What does the browser extension read?", a: "Only when you open it, and only the page you're on: public product, article or ticker information such as titles and listed prices. It never reads form fields, passwords or payment details, and it skips checkout, login and banking pages." },
  { q: "How does the AI work without seeing all my data?", a: "The advisor can only call specific tools that return your own records, calculated by the app. Sending data to an AI provider is off until you allow it in Settings; without it, a built-in deterministic engine answers supported questions." },
  { q: "Can I export or delete my data?", a: "Yes. Export everything as JSON or your transactions as CSV from Settings, and delete your account permanently at any time." },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_15%_10%,rgba(40,120,255,.18),transparent),radial-gradient(700px_400px_at_85%_20%,rgba(121,84,255,.14),transparent)]" />
        {/* planet horizon */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[640px] h-[900px] w-[1800px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,#0b1d3d,#050B18_80%)] shadow-[0_-30px_120px_-20px_rgba(57,217,255,.45)]" />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[640px] h-[900px] w-[1800px] -translate-x-1/2 rounded-[50%] border-t border-cyan/50" />
        <SiteHeader signedIn={!!user} />
        <div className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-24 pt-10 md:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-16">
          <div className="animate-rise">
            <VeltrixMark size={84} glow className="mb-6" />
            <p className="wordmark text-[34px] text-ink md:text-[44px]">VELTRIX</p>
            <p className="mt-2 font-display text-xs tracking-[0.42em] text-cyan">YOUR MONEY. SUPERCHARGED.</p>
            <h1 className="mt-8 max-w-xl font-display text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[56px]">Your money. Supercharged.</h1>
            <p className="mt-4 font-display text-xl text-ink2">Your financial life, connected by AI.</p>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink2">Track your money, uncover savings, research investments, compare deals, and make smarter financial decisions with one intelligent platform.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/app" : "/register"} className="brand-gradient inline-flex h-12 items-center gap-2 rounded-[12px] px-6 font-medium text-white shadow-[0_10px_40px_-10px_rgba(121,84,255,.9)] transition hover:brightness-110">
                Get Started Free <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="#platform" className="inline-flex h-12 items-center rounded-[12px] border border-line bg-panel/60 px-6 font-medium text-ink hover:border-blue/60">
                Explore the Platform
              </a>
            </div>
            <ul className="mt-10 grid max-w-lg grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              {[
                { icon: Lock, t: "Your data, your control", s: "Export or delete any time" },
                { icon: ShieldCheck, t: "No bank passwords", s: "Manual, CSV or official consent flows" },
                { icon: Sparkles, t: "Explainable AI", s: "Every number shows its source" },
              ].map(({ icon: Icon, t, s }) => (
                <li key={t} className="flex gap-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-cyan" aria-hidden />
                  <span>
                    <span className="block text-ink">{t}</span>
                    <span className="block text-xs text-ink3">{s}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <DashboardPreview />
        </div>
      </section>

      {/* Features */}
      <section id="platform" className="relative z-10 mx-auto max-w-[1240px] px-4 py-20 md:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Everything you need, powered by AI</h2>
        <p className="mt-2 max-w-2xl text-ink2">Seven areas of your financial life, one set of records, one advisor that understands all of them.</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="panel p-5">
              <span className="grid size-11 place-items-center rounded-[12px] bg-gradient-to-br from-blue/30 to-violet/30 text-cyan shadow-[0_0_24px_-6px_rgba(57,217,255,.6)]">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink2">{body}</p>
            </div>
          ))}
          <div className="panel flex flex-col justify-between bg-gradient-to-br from-blue/15 to-violet/15 p-5">
            <div>
              <span className="grid size-11 place-items-center rounded-[12px] brand-gradient text-white">
                <Layers className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">One Connected Financial Life</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink2">Save a product in the browser and see it next to your budget and goals on the web. Same account, same data.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Extension */}
      <section id="extension" className="relative z-10 border-y border-line-soft bg-bg2/60">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 py-20 md:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">Financial intelligence wherever you browse</h2>
            <p className="mt-3 text-ink2">The VELTRIX extension for Chrome and Edge reads the page you choose to analyze — a product, a news article, a stock quote, a hotel — and answers the question that matters: what does this mean for my money?</p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Product pages: the price you see, your own price history, cheaper prices you've recorded elsewhere, and your budget context.",
                "Financial news: publisher, date, tickers mentioned, and a summary only if you've allowed it.",
                "Quote pages: identify the ticker, check your watchlist, add it in one click.",
                "Travel pages: compare a fare or room rate against your trip budget.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-ink2">
                  <Check className="mt-0.5 size-4 shrink-0 text-pos" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-ink3">Runs only when you open it. Never reads form fields or passwords, never checks out for you, and skips checkout, login and banking pages.</p>
          </div>
          <ExtensionPreview />
        </div>
      </section>

      {/* AI + how it works */}
      <section className="relative z-10 mx-auto grid max-w-[1240px] gap-12 px-4 py-20 md:px-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">An advisor that shows its work</h2>
          <p className="mt-3 text-ink2">Every recommendation explains five things, so you can judge it yourself:</p>
          <dl className="mt-6 space-y-4 text-sm">
            {[
              ["What it is", "“Review 4 recurring subscriptions.”"],
              ["Why it matters", "They repeat monthly and you haven't confirmed them yet."],
              ["How it was calculated", "$15.49 × 12 + $11.99 × 12 + … = $1,085 a year."],
              ["Assumptions", "Amounts are inferred from past charges; savings only count if you cancel."],
              ["What you can do", "Confirm or dismiss each one on the Savings page."],
            ].map(([k, v]) => (
              <div key={k} className="panel-inner grid grid-cols-[150px_1fr] gap-3 p-3">
                <dt className="font-medium text-ink">{k}</dt>
                <dd className="text-ink2">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-ink3">Example for illustration. Potential savings are always labeled as potential.</p>
        </div>
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 space-y-4">
            {[
              ["Connect your accounts or add financial information.", "Add balances, import bank CSVs, or start with labeled demo data."],
              ["Let VELTRIX organize and analyze your data.", "Transactions are categorized with transparent rules you can override."],
              ["Discover personalized insights and opportunities.", "Recurring costs, budgets near their limits, goals off track, real price drops."],
              ["Make informed decisions and track your progress.", "Reports, goals and the advisor keep the picture current."],
            ].map(([t, s], i) => (
              <li key={t} className="flex gap-4">
                <span className="num grid size-9 shrink-0 place-items-center rounded-full border border-blue/50 bg-blue/10 font-display text-sm font-semibold text-cyan">{i + 1}</span>
                <span>
                  <span className="block font-medium">{t}</span>
                  <span className="block text-sm text-ink2">{s}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="relative z-10 border-y border-line-soft bg-bg2/60">
        <div className="mx-auto max-w-[1240px] px-4 py-20 md:px-6">
          <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight">Your financial data should work for you—and remain under your control.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: Lock, t: "Protected access", items: ["Passwords hashed with bcrypt", "Session and extension keys stored only as hashes", "Every record checked against your account on the server"] },
              { icon: ShieldCheck, t: "Consent first", items: ["AI processing is off until you allow it", "Article text is shared only with your permission", "Every privacy choice is recorded and reversible"] },
              { icon: MonitorSmartphone, t: "Minimal extension", items: ["Analyzes only the page you open it on", "No background scanning or browsing history", "Revocable keys you can disconnect any time"] },
            ].map(({ icon: Icon, t, items }) => (
              <div key={t} className="panel p-5">
                <Icon className="size-5 text-cyan" aria-hidden />
                <h3 className="mt-3 font-semibold">{t}</h3>
                <ul className="mt-3 space-y-2 text-sm text-ink2">
                  {items.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-pos" aria-hidden /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 mx-auto max-w-[1240px] px-4 py-20 md:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Plans</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="panel p-6">
            <p className="font-semibold">Free</p>
            <p className="num mt-2 font-display text-4xl font-semibold">$0</p>
            <ul className="mt-5 space-y-2 text-sm text-ink2">
              {["Accounts, transactions, budgets, goals and reports", "CSV import with duplicate detection", "Watchlists, alerts and research tools", "Browser extension and wishlist price tracking", "AI advisor (built-in analysis; language model when configured)"].map((x) => (
                <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-pos" aria-hidden />{x}</li>
              ))}
            </ul>
            <Link href={user ? "/app" : "/register"} className="brand-gradient mt-6 inline-flex h-11 w-full items-center justify-center rounded-[12px] font-medium text-white">
              Get Started Free
            </Link>
          </div>
          <div className="panel p-6">
            <p className="flex items-center gap-2 font-semibold">Premium <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-normal text-ink2">Not yet available</span></p>
            <p className="mt-2 font-display text-4xl font-semibold text-ink2">TBA</p>
            <ul className="mt-5 space-y-2 text-sm text-ink2">
              {["Automatic bank sync through an aggregation provider", "Real-time market data", "Verified merchant price feeds", "Priority support"].map((x) => (
                <li key={x} className="flex gap-2"><BadgePercent className="mt-0.5 size-4 shrink-0 text-ink3" aria-hidden />{x}</li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-ink3">These depend on third-party providers and aren&apos;t part of the current release. There are no paid plans today.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 mx-auto max-w-[900px] px-4 pb-20 md:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Questions</h2>
        <div className="mt-6 divide-y divide-line-soft rounded-[16px] border border-line">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <span className="text-cyan transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="relative overflow-hidden">
        <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[320px] w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#050B18" />
              <stop offset="1" stopColor="#2a1a5c" />
            </linearGradient>
            <linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#141b3a" />
              <stop offset="1" stopColor="#050B18" />
            </linearGradient>
          </defs>
          <rect width="1440" height="320" fill="url(#sky)" opacity=".7" />
          <path d="M0 230 L120 180 L210 210 L330 140 L430 190 L560 120 L690 200 L820 150 L930 190 L1060 110 L1180 170 L1290 130 L1440 190 L1440 320 L0 320 Z" fill="#0d1430" />
          <path d="M0 270 L160 220 L300 255 L470 205 L640 260 L800 215 L980 265 L1150 220 L1300 250 L1440 230 L1440 320 L0 320 Z" fill="url(#ridge)" />
        </svg>
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-4 pb-40 pt-16 md:px-6 lg:grid-cols-2">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <VeltrixMark size={64} glow />
            <p className="wordmark mt-4 text-3xl">VELTRIX</p>
            <p className="mt-2 font-display text-[11px] tracking-[0.42em] text-cyan">INTELLIGENCE FOR YOUR MONEY</p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
              More than a platform.
              <br />
              Your financial co-pilot.
            </h2>
            <p className="mt-4 max-w-md text-ink2">VELTRIX analyzes your financial life, surfaces the opportunities worth your attention, and helps you make smarter money decisions — with you in control of every one.</p>
            <Link href={user ? "/app" : "/register"} className="brand-gradient mt-6 inline-flex h-12 items-center gap-2 rounded-[12px] px-6 font-medium text-white">
              Get Started Free <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
