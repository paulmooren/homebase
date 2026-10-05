-- AlterTable
ALTER TABLE "recurring_items" ADD COLUMN     "accountId" TEXT;

-- AddForeignKey
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: where the item's owner (or "shared") has exactly one account,
-- that's unambiguously the account it belongs to. Anything else stays
-- unlinked until the user picks one.
UPDATE "recurring_items" ri
SET "accountId" = a.id
FROM "financial_accounts" a
WHERE a."householdId" = ri."householdId"
  AND a."ownerId" IS NOT DISTINCT FROM ri."ownerId"
  AND (
    SELECT COUNT(*) FROM "financial_accounts" a2
    WHERE a2."householdId" = ri."householdId"
      AND a2."ownerId" IS NOT DISTINCT FROM ri."ownerId"
  ) = 1;
