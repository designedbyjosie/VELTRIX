import type { Metadata } from "next";
import { requireUser } from "@/server/current-user";
import { activityHistory, privacyOverview } from "@/server/services/privacy";
import { PageHeader } from "@/components/page-header";
import { PrivacyView } from "@/components/privacy/privacy-view";

export const metadata: Metadata = { title: "Privacy & Permissions" };

export default async function PrivacyPage() {
  const user = await requireUser();
  const [overview, history] = await Promise.all([privacyOverview(user.id), activityHistory(user.id, {})]);
  return (
    <div className="space-y-5">
      <PageHeader title="Privacy & Permissions" description="What VELTRIX holds, where it came from, who else sees it, what VELTRIX may do, and everything that has happened." />
      <PrivacyView overview={overview} history={history} timezone={user.timezone} />
    </div>
  );
}
