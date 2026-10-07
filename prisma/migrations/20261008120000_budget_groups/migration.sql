-- CreateTable
CREATE TABLE "budget_groups" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "recurring_items" ADD COLUMN "budgetGroupId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "budget_groups_householdId_name_key" ON "budget_groups"("householdId", "name");

-- CreateIndex
CREATE INDEX "recurring_items_budgetGroupId_idx" ON "recurring_items"("budgetGroupId");

-- AddForeignKey
ALTER TABLE "budget_groups" ADD CONSTRAINT "budget_groups_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_budgetGroupId_fkey" FOREIGN KEY ("budgetGroupId") REFERENCES "budget_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
