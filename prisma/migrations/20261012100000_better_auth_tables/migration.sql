-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailIsVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_providerId_accountId_key" ON "auth_accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "auth_rate_limits_key_key" ON "auth_rate_limits"("key");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Copy today's sign-in data into the Better Auth tables. The old tables and columns stay untouched, so the
-- previous release keeps working until the cleanup migration. Deterministic ids make this safe to re-run.

-- Password sign-in: the bcrypt hash moves into a "credential" account.
INSERT INTO "auth_accounts" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT 'cred_' || "id", "id", 'credential', "id", "password", "createdAt", CURRENT_TIMESTAMP
FROM "users"
WHERE "password" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Google sign-in: each existing Google link carries over.
INSERT INTO "auth_accounts" ("id", "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken",
                             "accessTokenExpiresAt", "scope", "createdAt", "updatedAt")
SELECT 'goog_' || "id", "providerAccountId", 'google', "userId", "access_token", "refresh_token", "id_token",
       CASE WHEN "expires_at" IS NULL THEN NULL ELSE to_timestamp("expires_at") END, "scope",
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "oauth_accounts"
WHERE "provider" = 'google'
ON CONFLICT DO NOTHING;

-- Google verifies email ownership, so anyone who signed in with it counts as verified. Password-only users stay
-- unverified (grandfathered; only new sign-ups will have to verify).
UPDATE "users" SET "emailIsVerified" = true
WHERE "emailVerified" IS NOT NULL
   OR "id" IN (SELECT "userId" FROM "oauth_accounts" WHERE "provider" = 'google');
