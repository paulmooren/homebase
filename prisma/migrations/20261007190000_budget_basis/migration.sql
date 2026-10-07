-- CreateEnum
CREATE TYPE "BudgetBasis" AS ENUM ('LATEST', 'LOWEST', 'HIGHEST', 'AVERAGE', 'FIXED');

-- AlterTable
ALTER TABLE "recurring_items" ADD COLUMN "basis" "BudgetBasis" NOT NULL DEFAULT 'LATEST',
ADD COLUMN "keptAmount" DECIMAL(14,2);

-- Items typed in by hand keep the amount that was typed.
UPDATE "recurring_items" SET "basis" = 'FIXED' WHERE "source" = 'MANUAL';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "recurringExcluded" BOOLEAN NOT NULL DEFAULT false;
