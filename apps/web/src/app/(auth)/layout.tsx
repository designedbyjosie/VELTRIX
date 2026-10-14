import Link from "next/link";
import { Logo, VeltrixMark } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[-55vh] mx-auto h-[90vh] w-[160vw] max-w-none rounded-[50%] bg-[radial-gradient(closest-side,rgba(40,120,255,.28),rgba(121,84,255,.12)_55%,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[-62vh] mx-auto h-[80vh] w-[150vw] rounded-[50%] border-t border-cyan/40 shadow-[0_-20px_80px_-10px_rgba(57,217,255,.35)]" />
      <div className="relative w-full max-w-[420px]">
        <Link href="/" className="mb-8 flex justify-center" aria-label="VELTRIX home">
          <Logo size={30} />
        </Link>
        <div className="glass rounded-[20px] p-7 shadow-2xl">{children}</div>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-ink3">
          <VeltrixMark size={12} /> Passwords are hashed with bcrypt; sessions use HttpOnly cookies.
        </p>
      </div>
    </div>
  );
}
