-- AlterTable
ALTER TABLE "recurring_items" ADD COLUMN     "detectedName" TEXT;

-- Existing detected items haven't been renamed as far as the schema knows,
-- so their current name is the merchant text they came from.
UPDATE "recurring_items" SET "detectedName" = "name" WHERE "source" = 'DETECTED';
