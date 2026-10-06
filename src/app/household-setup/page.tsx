import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseholdIdForUser } from "@/server/api/household";
import { AuthFrame } from "@/components/auth-frame";
import { HouseholdSetupForm } from "@/components/household-setup-form";

export default async function HouseholdSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const householdId = await getHouseholdIdForUser(prisma, session.user.id);
  if (householdId) redirect("/dashboard");

  return (
    <AuthFrame width="max-w-md">
      <HouseholdSetupForm />
    </AuthFrame>
  );
}
