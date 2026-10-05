-- AlterTable
ALTER TABLE "households" ADD COLUMN     "disabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- A Member's Personal data goes with them instead of silently turning
-- Shared (tasks stay SetNull: they are assignments, not private data).
ALTER TABLE "financial_accounts" DROP CONSTRAINT "financial_accounts_ownerId_fkey";
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budgets" DROP CONSTRAINT "budgets_ownerId_fkey";
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_items" DROP CONSTRAINT "recurring_items_ownerId_fkey";
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
