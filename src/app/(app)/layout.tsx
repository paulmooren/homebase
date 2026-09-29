import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseholdIdForUser } from "@/server/api/household";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const householdId = await getHouseholdIdForUser(prisma, session.user.id);
  if (!householdId) redirect("/household-setup");

  const userName = session.user.name ?? session.user.email?.split("@")[0] ?? "there";

  return <AppShell userName={userName}>{children}</AppShell>;
}
