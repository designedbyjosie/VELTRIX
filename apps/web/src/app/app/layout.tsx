import { requireUser } from "@/server/current-user";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <ToastProvider>
      <AppShell user={{ displayName: user.displayName, email: user.email, plan: user.plan, hasDemoData: user.hasDemoData }}>{children}</AppShell>
    </ToastProvider>
  );
}
