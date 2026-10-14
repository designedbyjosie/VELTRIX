import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";

const DOCS: Record<string, { title: string; body: { h: string; p: string }[] }> = {
  privacy: {
    title: "Privacy Policy",
    body: [
      { h: "Draft notice", p: "This is a product draft describing how this software handles data. It has not been reviewed by counsel and is not a substitute for a legally reviewed policy before public launch." },
      { h: "What we store", p: "Your profile, the financial records you enter or import, items you save with the browser extension, AI conversations, privacy choices and security events. Passwords, session keys and extension keys are stored only as one-way hashes." },
      { h: "What the extension sends", p: "Only when you open it on a page: the page address and public product, article, ticker or travel details. Article text is sent only if you allow it. Form fields, passwords and payment details are never read." },
      { h: "AI processing", p: "Off by default. If you allow it and a provider is configured, your question and the specific records needed to answer it are sent to that provider." },
      { h: "Your controls", p: "Export everything from Settings, withdraw consent at any time, disconnect the extension, and delete your account permanently." },
    ],
  },
  terms: {
    title: "Terms of Service",
    body: [
      { h: "Draft notice", p: "These terms are a product draft and must be reviewed by counsel before public launch." },
      { h: "Information, not advice", p: "VELTRIX provides information, calculations and research tools. It is not a registered investment adviser, broker-dealer, bank or tax professional, and nothing in the product is financial, investment, tax or legal advice." },
      { h: "No guarantees", p: "Projections and estimates depend on stated assumptions. Market data may be delayed or simulated (and is labeled as such). Past performance does not predict future results." },
      { h: "Your decisions", p: "VELTRIX does not move money, execute trades, make purchases or book travel. You remain responsible for your financial decisions." },
    ],
  },
  disclosures: {
    title: "Disclosures",
    body: [
      { h: "Bank data", p: "Bank connections are provided by Plaid. VELTRIX receives read-only access to balances and transactions; it cannot move money, and access tokens are encrypted at rest." },
      { h: "Market data", p: "Quotes and company news come from third-party providers (Finnhub), may be delayed depending on the exchange, and are shown with their source and time. Past performance does not predict future results." },
      { h: "Deals and rewards", p: "A deal is marked Verified only when VELTRIX itself recorded both prices. Coupons and cashback you add are not verified. Point values use the rate you enter." },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const doc = DOCS[(await params).doc];
  if (!doc) notFound();
  return (
    <div>
      <SiteHeader signedIn={false} />
      <main className="mx-auto max-w-[760px] px-4 py-12 md:px-6">
        <h1 className="font-display text-3xl font-semibold">{doc.title}</h1>
        <div className="mt-8 space-y-6">
          {doc.body.map((s) => (
            <section key={s.h}>
              <h2 className="font-semibold">{s.h}</h2>
              <p className="mt-1.5 leading-relaxed text-ink2">{s.p}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
