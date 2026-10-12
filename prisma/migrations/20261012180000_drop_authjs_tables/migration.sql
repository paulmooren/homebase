-- Cleanup after the move to Better Auth: drop the Auth.js tables and the two legacy columns on users.
-- The guards make this refuse to run unless everything it removes already lives in the Better Auth tables.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."password" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "auth_accounts" a
        WHERE a."userId" = u."id" AND a."providerId" = 'credential' AND a."password" IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'users.password holds a hash that is missing from auth_accounts; refusing to drop it';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "oauth_accounts" o
    WHERE NOT EXISTS (
      SELECT 1 FROM "auth_accounts" a
      WHERE a."userId" = o."userId" AND a."providerId" = o."provider" AND a."accountId" = o."providerAccountId"
    )
  ) THEN
    RAISE EXCEPTION 'oauth_accounts holds a link that is missing from auth_accounts; refusing to drop it';
  END IF;
END $$;

-- Anyone whose old verified timestamp is set stays verified.
UPDATE "users" SET "emailIsVerified" = true WHERE "emailVerified" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "oauth_accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailVerified",
DROP COLUMN "password";

-- DropTable
DROP TABLE "oauth_accounts";

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "verification_tokens";

