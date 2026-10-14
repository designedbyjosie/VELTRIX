import Link from "next/link";
import { VeltrixMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <VeltrixMark size={48} glow className="mx-auto" />
        <h1 className="mt-6 font-display text-2xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-ink2">The link may be out of date.</p>
        <Link href="/" className="mt-6 inline-block text-cyan hover:underline">
          Go to VELTRIX home
        </Link>
      </div>
    </div>
  );
}
