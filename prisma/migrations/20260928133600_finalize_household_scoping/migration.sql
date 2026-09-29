-- DropForeignKey
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_userId_fkey";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_userId_fkey";

-- DropForeignKey
ALTER TABLE "financial_accounts" DROP CONSTRAINT "financial_accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "net_worth_snapshots" DROP CONSTRAINT "net_worth_snapshots_userId_fkey";

-- DropForeignKey
ALTER TABLE "recurring_items" DROP CONSTRAINT "recurring_items_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- DropIndex
DROP INDEX "budgets_userId_categoryId_key";

-- DropIndex
DROP INDEX "categories_userId_name_key";

-- DropIndex
DROP INDEX "financial_accounts_userId_idx";

-- DropIndex
DROP INDEX "net_worth_snapshots_userId_date_key";

-- DropIndex
DROP INDEX "recurring_items_userId_name_key";

-- DropIndex
DROP INDEX "recurring_items_userId_status_idx";

-- DropIndex
DROP INDEX "transactions_userId_date_idx";

-- AlterTable
ALTER TABLE "budgets" DROP COLUMN "userId",
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "userId",
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "financial_accounts" DROP COLUMN "userId",
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "net_worth_snapshots" DROP COLUMN "userId",
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "recurring_items" DROP COLUMN "userId",
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "userId",
ALTER COLUMN "householdId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "budgets_householdId_categoryId_key" ON "budgets"("householdId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_householdId_name_key" ON "categories"("householdId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "net_worth_snapshots_householdId_date_key" ON "net_worth_snapshots"("householdId", "date");

-- CreateIndex
CREATE INDEX "recurring_items_householdId_status_idx" ON "recurring_items"("householdId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_items_householdId_name_key" ON "recurring_items"("householdId", "name");

