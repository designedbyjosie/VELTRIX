import { cookies } from "next/headers";
import { requireUser } from "@/server/current-user";
import { getConsents } from "@/server/services/users";
import { listApiTokens, listAuditEvents, listSessions } from "@/server/services/settings";
import { integrationStatuses } from "@/server/providers/integrations";
import { resolveSession, SESSION_COOKIE } from "@/server/auth/session";
import { SettingsView } from "@/components/settings/settings-view";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const session = await resolveSession((await cookies()).get(SESSION_COOKIE)?.value);
  const [consents, sessions, tokens, events] = await Promise.all([getConsents(user.id), listSessions(user.id, session?.sessionId), listApiTokens(user.id), listAuditEvents(user.id)]);
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Profile, privacy choices, connected devices and your data." />
      <SettingsView
        profile={{ displayName: user.displayName, email: user.email, baseCurrency: user.baseCurrency, timezone: user.timezone, hasDemoData: user.hasDemoData }}
        preference={user.preference ? { notifyBudget: user.preference.notifyBudget, notifyPriceDrops: user.preference.notifyPriceDrops, notifyGoals: user.preference.notifyGoals, extensionAutoAnalyze: user.preference.extensionAutoAnalyze } : null}
        consents={consents}
        sessions={sessions}
        tokens={tokens}
        events={events}
        integrations={integrationStatuses()}
      />
    </div>
  );
}
