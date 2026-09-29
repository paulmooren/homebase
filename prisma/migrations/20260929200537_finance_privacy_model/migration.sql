-- DropIndex
DROP INDEX "budgets_householdId_categoryId_key";

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "ownerScope" TEXT NOT NULL DEFAULT 'HOUSEHOLD',
ADD COLUMN     "visibleToHousehold" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "financial_accounts" ADD COLUMN     "visibleToHousehold" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "recurring_items" ADD COLUMN     "visibleToHousehold" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: carry each user's old blanket shareRecurringItems setting onto
-- their existing personal recurring items' new per-row visibleToHousehold,
-- before the column it came from is dropped below. Shared items (ownerId
-- null) are untouched and keep the column's default of true.
UPDATE "recurring_items" ri
SET "visibleToHousehold" = u."shareRecurringItems"
FROM "users" u
WHERE ri."ownerId" = u.id;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "shareRecurringItems";

-- CreateIndex
CREATE INDEX "budgets_householdId_ownerId_idx" ON "budgets"("householdId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_householdId_categoryId_ownerScope_key" ON "budgets"("householdId", "categoryId", "ownerScope");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
