// Dev-only backdoor that seeds a session directly via Prisma, bypassing
// Resend, for local testing without sending real email. Household-aware:
// pass an invite code as the second arg to auto-join an existing household,
// for spinning up a two-person test household without a real invite flow.
//
//   node scripts/dev-login.mjs personA@test.local
//   node scripts/dev-login.mjs personB@test.local <invite code from A's Settings page>
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();
const [, , emailArg, inviteCodeArg] = process.argv;
const email = emailArg ?? "paul.mooren@sdui.de";

const user = await prisma.user.upsert({
  where: { email },
  create: { email, name: email.split("@")[0] },
  update: {},
});

if (inviteCodeArg) {
  const invite = await prisma.householdInvite.findFirst({
    where: { code: inviteCodeArg.toUpperCase(), revokedAt: null },
  });
  if (!invite) {
    console.error(`No active invite with code ${inviteCodeArg}`);
    process.exit(1);
  }
  await prisma.householdMember.upsert({
    where: { userId: user.id },
    create: { userId: user.id, householdId: invite.householdId },
    update: {},
  });
}

const sessionToken = randomBytes(32).toString("hex");
const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

await prisma.session.create({
  data: { sessionToken, userId: user.id, expires },
});

console.log(`session token: ${sessionToken}`);

const membership = await prisma.householdMember.findUnique({ where: { userId: user.id } });
if (membership) {
  const invite = await prisma.householdInvite.findFirst({
    where: { householdId: membership.householdId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (invite) console.log(`household invite code: ${invite.code}`);
} else {
  console.log("no household yet — sign in and visit /household-setup");
}

await prisma.$disconnect();
