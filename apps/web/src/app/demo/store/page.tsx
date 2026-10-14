import Link from "next/link";
import { VeltrixMark } from "@/components/logo";

export const metadata = { title: "Demo store — try the extension", robots: { index: false }, openGraph: { siteName: "VELTRIX Demo Store", type: "website" } };

// Static, trusted JSON-LD describing the demo product (no user input involved).
const PRODUCT_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Aurora ANC Wireless Headphones (Demo Product)",
  brand: { "@type": "Brand", name: "Aurora" },
  sku: "AUR-ANC-01",
  gtin13: "0000000000017",
  offers: { "@type": "Offer", price: "249.00", priceCurrency: "USD", availability: "https://schema.org/InStock" },
});

/**
 * A fake product page for trying the VELTRIX extension safely. It is not a store:
 * nothing can be bought here.
 */
export default function DemoStorePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* eslint-disable-next-line react/no-danger -- constant JSON-LD defined above */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: PRODUCT_LD }} />
      <p className="mb-6 rounded-[12px] border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-[#FFCF85]">
        Demo page for trying the VELTRIX browser extension. This is not a real store and nothing can be purchased.
      </p>
      <div className="panel grid gap-6 p-6 md:grid-cols-[220px_1fr]">
        <div className="grid aspect-square place-items-center rounded-[14px] bg-white/90 text-bg">
          <svg viewBox="0 0 24 24" className="size-24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
            <rect x="3" y="14" width="4" height="6" rx="1.5" />
            <rect x="17" y="14" width="4" height="6" rx="1.5" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-ink2">Aurora</p>
          <h1 className="font-display text-2xl font-semibold">Aurora ANC Wireless Headphones (Demo Product)</h1>
          <p className="num mt-3 font-display text-3xl font-semibold">$249.00</p>
          <p className="mt-1 text-sm text-pos">In stock</p>
          <p className="mt-4 text-sm text-ink2">Open the VELTRIX extension on this page to see how it reads a product, compares it with your recorded prices and budget, and saves it to your wishlist.</p>
          <p className="mt-6 flex items-center gap-2 text-xs text-ink3">
            <VeltrixMark size={14} /> <Link href="/app/shopping" className="text-cyan hover:underline">Your VELTRIX wishlist</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
