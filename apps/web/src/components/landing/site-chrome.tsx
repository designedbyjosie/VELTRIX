import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="relative z-20 mx-auto flex max-w-[1240px] items-center gap-6 px-4 py-5 md:px-6">
      <Link href="/" aria-label="VELTRIX home">
        <Logo />
      </Link>
      <nav aria-label="Site" className="ml-6 hidden gap-6 text-sm text-ink2 md:flex">
        <a href="#platform" className="hover:text-ink">Platform</a>
        <a href="#extension" className="hover:text-ink">Extension</a>
        <a href="#security" className="hover:text-ink">Security</a>
        <a href="#pricing" className="hover:text-ink">Pricing</a>
        <a href="#faq" className="hover:text-ink">FAQ</a>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {signedIn ? (
          <Link href="/app" className="brand-gradient inline-flex h-9 items-center rounded-[10px] px-4 text-sm font-medium text-white">
            Open dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className="hidden h-9 items-center rounded-[10px] px-3 text-sm text-ink2 hover:text-ink sm:inline-flex">
              Sign in
            </Link>
            <Link href="/register" className="brand-gradient inline-flex h-9 items-center rounded-[10px] px-4 text-sm font-medium text-white">
              Get Started Free
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line-soft">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 text-sm md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-ink3">Intelligence for your money. VELTRIX provides financial information and research tools, not regulated financial, tax or legal advice.</p>
        </div>
        <div>
          <p className="mb-2 font-medium text-ink">Product</p>
          <ul className="space-y-1.5 text-ink2">
            <li><Link href="/#platform" className="hover:text-ink">Platform</Link></li>
            <li><Link href="/#extension" className="hover:text-ink">Browser extension</Link></li>
            <li><Link href="/#pricing" className="hover:text-ink">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-medium text-ink">Legal</p>
          <ul className="space-y-1.5 text-ink2">
            <li><Link href="/legal/privacy" className="hover:text-ink">Privacy Policy</Link></li>
            <li><Link href="/legal/terms" className="hover:text-ink">Terms of Service</Link></li>
            <li><Link href="/legal/disclosures" className="hover:text-ink">Disclosures</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-medium text-ink">Support</p>
          <ul className="space-y-1.5 text-ink2">
            <li><Link href="/support" className="hover:text-ink">Help & contact</Link></li>
            <li><Link href="/#faq" className="hover:text-ink">FAQ</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-line-soft py-5 text-center text-xs text-ink3">© {new Date().getFullYear()} VELTRIX. All rights reserved.</p>
    </footer>
  );
}
