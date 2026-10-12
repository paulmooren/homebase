// Read-only check run after the better_auth_tables migration, per environment:
//   set -a && . ./.env && set +a && npx tsx scripts/verify-auth-migration.ts
// Every password user must have a credential account, every Google link must be carried over,
// and nobody who signed in with Google may be left unverified.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [withPassword, credential, oldGoogle, newGoogle, unverifiedGoogle] = await Promise.all([
    prisma.user.count({ where: { password: { not: null } } }),
    prisma.authAccount.count({ where: { providerId: "credential" } }),
    prisma.account.count({ where: { provider: "google" } }),
    prisma.authAccount.count({ where: { providerId: "google" } }),
    prisma.user.count({ where: { emailIsVerified: false, accounts: { some: { provider: "google" } } } }),
  ]);

  const checks = [
    ["password users == credential accounts", withPassword, credential],
    ["old Google links == new Google accounts", oldGoogle, newGoogle],
    ["Google users left unverified == 0", unverifiedGoogle, 0],
  ] as const;

  let failed = false;
  for (const [label, a, b] of checks) {
    const ok = a === b;
    failed ||= !ok;
    console.log(`${ok ? "OK  " : "FAIL"} ${label}: ${a} vs ${b}`);
  }
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main();
