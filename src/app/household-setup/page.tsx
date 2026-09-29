import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseholdIdForUser } from "@/server/api/household";
import { HouseholdSetupForm } from "@/components/household-setup-form";

export default async function HouseholdSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const householdId = await getHouseholdIdForUser(prisma, session.user.id);
  if (householdId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <HouseholdSetupForm />
    </main>
  );
}
