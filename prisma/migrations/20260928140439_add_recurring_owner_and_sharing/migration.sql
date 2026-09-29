-- AlterTable
ALTER TABLE "recurring_items" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "shareRecurringItems" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
