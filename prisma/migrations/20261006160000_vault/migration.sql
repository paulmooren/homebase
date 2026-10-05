-- CreateTable
CREATE TABLE "vault_entries" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "visibleToHousehold" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expiresOn" DATE,
    "fields" JSONB NOT NULL,
    "noteEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vault_entries_householdId_idx" ON "vault_entries"("householdId");

-- AddForeignKey
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
