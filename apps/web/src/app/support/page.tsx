import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";

export const metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <div>
      <SiteHeader signedIn={false} />
      <main className="mx-auto max-w-[760px] px-4 py-12 md:px-6">
        <h1 className="font-display text-3xl font-semibold">Help & contact</h1>
        <div className="mt-6 space-y-5 leading-relaxed text-ink2">
          <p>Most answers are in the FAQ on the home page. For setup, see the project README: running the web app, configuring integrations and loading the browser extension.</p>
          <p>A support inbox hasn&apos;t been configured for this deployment. Operators should replace this page with their support contact before launch.</p>
          <p>Security issues: report privately to the deployment&apos;s security contact rather than in a public issue tracker.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
