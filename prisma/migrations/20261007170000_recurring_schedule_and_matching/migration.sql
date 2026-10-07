-- AlterTable: recurring items get a Reminder-style schedule and the details to recognise their transactions
ALTER TABLE "recurring_items"
ADD COLUMN "intervalCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "intervalUnit" "ScheduleUnit" NOT NULL DEFAULT 'MONTH',
ADD COLUMN "amountVaries" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "toAccountId" TEXT,
ADD COLUMN "matchIban" TEXT,
ADD COLUMN "matchText" TEXT,
ADD COLUMN "matchKey" TEXT;

-- Carry the old frequency over; it stays (now optional) until the new code is live everywhere.
UPDATE "recurring_items"
SET "intervalUnit" = CASE "frequency"
  WHEN 'WEEKLY' THEN 'WEEK'::"ScheduleUnit"
  WHEN 'YEARLY' THEN 'YEAR'::"ScheduleUnit"
  ELSE 'MONTH'::"ScheduleUnit"
END;

ALTER TABLE "recurring_items" ALTER COLUMN "frequency" DROP NOT NULL;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "recurringItemId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_recurringItemId_idx" ON "transactions"("recurringItemId");

-- AddForeignKey
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurringItemId_fkey" FOREIGN KEY ("recurringItemId") REFERENCES "recurring_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
