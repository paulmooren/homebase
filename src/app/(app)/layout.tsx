import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { HydrateClient, caller, getServerContext, loadHousehold, loadQuery } from "@/trpc/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getServerContext();
  if (!ctx.session?.user) redirect("/signin");

  // The shell and every page ask for these two, so they arrive with the page. Side by side with the check
  // that you belong to a Household: one round trip to the database, not three.
  const [householdId] = await Promise.all([
    ctx.getHouseholdId(),
    loadQuery("user.me", undefined, () => caller.user.me()),
    loadHousehold(),
  ]);
  if (!householdId) redirect("/household-setup");

  const userName = ctx.session.user.name ?? ctx.session.user.email?.split("@")[0] ?? "there";

  return (
    <HydrateClient>
      <AppShell userName={userName}>{children}</AppShell>
    </HydrateClient>
  );
}
