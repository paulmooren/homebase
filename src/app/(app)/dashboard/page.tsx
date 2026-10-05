"use client";

import { useEffect, useState } from "react";

import { trpc } from "@/trpc/react";
import Link from "next/link";
import { useModules } from "@/components/use-modules";
import { MissingStatementsCard } from "@/components/dashboard/missing-statements-card";
import { ShoppingCard } from "@/components/dashboard/shopping-card";
import { TasksSnapshot } from "@/components/dashboard/tasks-snapshot";
import { NetWorthSnapshot } from "@/components/dashboard/net-worth-snapshot";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";

export default function DashboardPage() {
  const { data: accounts, isLoading } = trpc.account.list.useQuery();
  const { ready, isEnabled } = useModules();
  const finance = isEnabled("finance");
  const tasks = isEnabled("tasks");
  const shopping = isEnabled("shopping");

  // Decided once, from the account count at first load — a mid-wizard mutation
  // (e.g. creating the first account in step 1) must not yank the wizard away
  // just because the live count changed.
  const [showWizard, setShowWizard] = useState<boolean | null>(null);
  useEffect(() => {
    if (showWizard === null && accounts && ready) {
      // The wizard only sets up Finance, so it is skipped when Finance is off.
      setShowWizard(finance && accounts.length === 0);
    }
  }, [accounts, showWizard, ready, finance]);

  if (isLoading || showWizard === null) {
    return <div className="py-10 text-center text-text-muted">Loading…</div>;
  }

  if (showWizard) {
    return <OnboardingWizard onComplete={() => setShowWizard(false)} />;
  }

  if (!finance && !tasks && !shopping) {
    return (
      <p className="py-10 text-center text-[13.5px] text-text-muted">
        Nothing to show here.{" "}
        <Link href="/settings/household" className="text-accent hover:opacity-80">
          Choose what your household uses in Settings
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      {finance && <MissingStatementsCard />}
      {shopping && <ShoppingCard />}
      {tasks && <TasksSnapshot />}
      {finance && <NetWorthSnapshot />}
    </>
  );
}
