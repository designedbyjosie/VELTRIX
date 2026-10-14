import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/current-user";
import { VerifyEmail } from "@/components/auth/account-flows";

export const metadata = { title: "Confirm your email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const user = await getCurrentUser();
  if (!token && user?.emailVerified) redirect("/app");
  return <VerifyEmail token={token ?? null} email={user?.email ?? null} signedIn={!!user} />;
}
