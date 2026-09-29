import type { PrismaClient } from "@prisma/client";

export async function getHouseholdIdForUser(prisma: PrismaClient, userId: string) {
  const membership = await prisma.householdMember.findUnique({
    where: { userId },
    select: { householdId: true },
  });
  return membership?.householdId ?? null;
}
