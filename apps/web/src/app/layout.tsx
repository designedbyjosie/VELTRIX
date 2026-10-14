import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["300", "400", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "VELTRIX — Your money. Supercharged.", template: "%s · VELTRIX" },
  description: "The all-in-one AI financial advisor: track spending, build budgets, research investments, compare deals and plan trips in one connected platform.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#050B18", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
