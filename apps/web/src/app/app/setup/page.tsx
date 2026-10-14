import type { Metadata } from "next";
import { requireUser } from "@/server/current-user";
import { plaidConfigured } from "@/server/providers/plaid";
import { SetupWizard } from "@/components/setup/setup-wizard";

export const metadata: Metadata = { title: "Set up VELTRIX" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  const user = await requireUser();
  const { path } = await searchParams;
  return <SetupWizard initialPath={path === "bank" || path === "manual" ? path : null} plaidConfigured={plaidConfigured()} currency={user.baseCurrency} firstName={user.displayName.split(" ")[0]} />;
}
