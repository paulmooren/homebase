// Dev-only backdoor that mints a signed session JWT directly, bypassing
// Google/password sign-in, for local testing. Household-aware: pass an
// invite code as the second arg to auto-join an existing household, for
// spinning up a two-person test household without a real invite flow.
//
//   node scripts/dev-login.mjs personA@test.local
//   node scripts/dev-login.mjs personB@test.local <invite code from A's Settings page>
import { PrismaClient } from "@prisma/client";
import { encode } from "@auth/core/jwt";

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

const sessionToken = await encode({
  token: { id: user.id, sub: user.id, email: user.email, name: user.name },
  secret: process.env.AUTH_SECRET,
  salt: "authjs.session-token",
});

console.log(`cookie name: authjs.session-token`);
console.log(`cookie value: ${sessionToken}`);

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
