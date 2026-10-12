// Dev-only backdoor that inserts a Better Auth session row and prints its signed cookie, bypassing
// Google/password sign-in, for local testing. Refuses to run unless DATABASE_URL looks local-dev
// (set DEV_LOGIN_ALLOW_REMOTE=1 to allow the Neon dev branch). Household-aware: pass an
// invite code as the second arg to auto-join an existing household, for
// spinning up a two-person test household without a real invite flow.
//
//   node scripts/dev-login.mjs personA@test.local
//   node scripts/dev-login.mjs personB@test.local <invite code from A's Settings page>
import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

const prisma = new PrismaClient();
if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is not set");
const dbHost = new URL(process.env.DATABASE_URL).hostname;
const isLocal = ["localhost", "127.0.0.1"].includes(dbHost);
if (!isLocal && process.env.DEV_LOGIN_ALLOW_REMOTE !== "1") {
  console.error(`Refusing to mint a session against ${dbHost}. Set DEV_LOGIN_ALLOW_REMOTE=1 for the Neon dev branch.`);
  process.exit(1);
}
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

const token = randomBytes(24).toString("base64url");
await prisma.authSession.create({
  data: { id: randomUUID(), token, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
});
// Same scheme Better Auth signs its cookies with: "<token>.<base64 HMAC-SHA256>", URL-encoded.
const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64");
const cookieValue = encodeURIComponent(`${token}.${signature}`);

console.log(`cookie name: better-auth.session_token`);
console.log(`cookie value: ${cookieValue}`);

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
