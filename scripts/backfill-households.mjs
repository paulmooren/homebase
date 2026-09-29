import { PrismaClient } from "@prisma/client";
import { randomInt } from "crypto";

const prisma = new PrismaClient();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function generateInviteCode(length = 10) {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });

for (const user of users) {
  const existing = await prisma.householdMember.findUnique({ where: { userId: user.id } });
  if (existing) {
    console.log(`skip ${user.email}: already has a household`);
    continue;
  }

  const household = await prisma.household.create({
    data: {
      name: `${user.name ?? user.email.split("@")[0]}'s Household`,
      members: { create: { userId: user.id } },
    },
  });

  await prisma.$transaction([
    // Pre-existing accounts default to personal (not shared) — a partner
    // invited later shouldn't suddenly see data created before the household
    // existed without an explicit "mark as shared" action.
    prisma.financialAccount.updateMany({
      where: { userId: user.id },
      data: { householdId: household.id, ownerId: user.id },
    }),
    prisma.category.updateMany({ where: { userId: user.id }, data: { householdId: household.id } }),
    prisma.transaction.updateMany({ where: { userId: user.id }, data: { householdId: household.id } }),
    prisma.budget.updateMany({ where: { userId: user.id }, data: { householdId: household.id } }),
    prisma.recurringItem.updateMany({ where: { userId: user.id }, data: { householdId: household.id } }),
    prisma.netWorthSnapshot.updateMany({ where: { userId: user.id }, data: { householdId: household.id } }),
  ]);

  await prisma.householdInvite.create({
    data: { householdId: household.id, code: generateInviteCode(), createdByUserId: user.id },
  });

  console.log(`migrated ${user.email} -> household ${household.id}`);
}

await prisma.$disconnect();
