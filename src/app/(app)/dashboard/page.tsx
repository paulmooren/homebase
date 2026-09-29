"use client";

import { useEffect, useState } from "react";

import { trpc } from "@/trpc/react";
import { RemindersCard } from "@/components/dashboard/reminders-card";
import { NetWorthSnapshot } from "@/components/dashboard/net-worth-snapshot";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";

export default function DashboardPage() {
  const { data: accounts, isLoading } = trpc.account.list.useQuery();

  // Decided once, from the account count at first load — a mid-wizard mutation
  // (e.g. creating the first account in step 1) must not yank the wizard away
  // just because the live count changed.
  const [showWizard, setShowWizard] = useState<boolean | null>(null);
  useEffect(() => {
    if (showWizard === null && accounts) {
      setShowWizard(accounts.length === 0);
    }
  }, [accounts, showWizard]);

  if (isLoading || showWizard === null) {
    return <div className="py-10 text-center text-text-muted">Loading…</div>;
  }

  if (showWizard) {
    return <OnboardingWizard onComplete={() => setShowWizard(false)} />;
  }

  return (
    <>
      <RemindersCard />
      <NetWorthSnapshot />
    </>
  );
}
