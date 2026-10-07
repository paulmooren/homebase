-- AlterTable
ALTER TABLE "recurring_items" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Keep today's order: oldest first, one distinct number per item within its household.
UPDATE "recurring_items" r
SET "sortOrder" = s.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY "householdId" ORDER BY "createdAt", id) AS rn
  FROM "recurring_items"
) s
WHERE r.id = s.id;
