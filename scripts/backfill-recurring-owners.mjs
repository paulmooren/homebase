import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// One-off: pre-existing RecurringItem rows have no ownerId (they predate
// the household feature entirely). For a household with exactly one
// member, default their items to personal (not shared) — same
// privacy-conserving default used for the FinancialAccount migration, so
// nothing silently becomes visible the moment a second member joins.
// Households with 2+ members already are left alone (ownerId stays null).
const households = await prisma.household.findMany({
  include: { members: { select: { userId: true } } },
});

for (const household of households) {
  if (household.members.length !== 1) {
    console.log(`skip ${household.id}: ${household.members.length} members`);
    continue;
  }
  const [member] = household.members;
  const result = await prisma.recurringItem.updateMany({
    where: { householdId: household.id, ownerId: null },
    data: { ownerId: member.userId },
  });
  console.log(`${household.id}: set ownerId on ${result.count} item(s)`);
}

await prisma.$disconnect();
