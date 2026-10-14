"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FinancialProfile } from "@/server/services/twin";
import { Segmented } from "@/components/ui";
import { ProfilePanel } from "./profile-panel";
import { WhatIf } from "./what-if";
import { PurchaseDecision } from "./decision";
import { StressTest } from "./stress";
import { SavedPlans } from "./saved-plans";
import { Assumptions } from "./assumptions";

const TABS = [
  { value: "profile", label: "My picture" },
  { value: "whatif", label: "What if…" },
  { value: "decide", label: "Can I afford it?" },
  { value: "stress", label: "Stress test" },
  { value: "saved", label: "Saved plans" },
  { value: "assumptions", label: "Assumptions" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export function PlanLab({ profile, tab, preset, purchase }: { profile: FinancialProfile; tab: string | null; preset: string | null; purchase?: { label?: string; price?: string } }) {
  const router = useRouter();
  const initial: Tab = TABS.some((t) => t.value === tab) ? (tab as Tab) : purchase ? "decide" : preset ? "whatif" : "profile";
  const [active, setActive] = useState<Tab>(initial);
  const select = (t: Tab) => {
    setActive(t);
    router.replace(`/app/plan?tab=${t}`, { scroll: false });
  };
  return (
    <div className="space-y-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <Segmented label="What-if Lab sections" value={active} onChange={select} options={TABS.map((t) => ({ value: t.value, label: t.label }))} />
      </div>
      {active === "profile" && <ProfilePanel profile={profile} />}
      {active === "whatif" && <WhatIf currency={profile.currency} goals={profile.goals.map((g) => ({ id: g.id, name: g.name }))} initial={preset} />}
      {active === "decide" && <PurchaseDecision currency={profile.currency} initial={purchase} />}
      {active === "stress" && <StressTest currency={profile.currency} />}
      {active === "saved" && <SavedPlans currency={profile.currency} />}
      {active === "assumptions" && <Assumptions profile={profile} />}
    </div>
  );
}
