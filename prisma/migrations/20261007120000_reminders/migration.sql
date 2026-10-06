-- CreateEnum
CREATE TYPE "ScheduleUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('FROM_DONE', 'FIXED');

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "intervalUnit" "ScheduleUnit" NOT NULL,
    "mode" "ScheduleMode" NOT NULL DEFAULT 'FROM_DONE',
    "nextDueDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_completions" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDateAtCompletion" DATE,

    CONSTRAINT "reminder_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_householdId_nextDueDate_idx" ON "reminders"("householdId", "nextDueDate");

-- CreateIndex
CREATE INDEX "reminder_completions_reminderId_completedAt_idx" ON "reminder_completions"("reminderId", "completedAt");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_completions" ADD CONSTRAINT "reminder_completions_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_completions" ADD CONSTRAINT "reminder_completions_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move the existing recurring "tasks" over as reminders: one interval of their
-- old frequency, counted from when they were done. The next due date is the old
-- one if it had one, else last-done + one interval, else today.
INSERT INTO "reminders" ("id", "householdId", "ownerId", "title", "intervalCount", "intervalUnit", "mode", "nextDueDate", "createdAt", "updatedAt")
SELECT
    t."id",
    t."householdId",
    t."ownerId",
    t."title",
    1,
    (CASE t."frequency" WHEN 'WEEKLY' THEN 'WEEK' WHEN 'MONTHLY' THEN 'MONTH' ELSE 'YEAR' END)::"ScheduleUnit",
    'FROM_DONE',
    COALESCE(
        t."dueDate",
        (t."completedAt"::date + (CASE t."frequency" WHEN 'WEEKLY' THEN INTERVAL '7 days' WHEN 'MONTHLY' THEN INTERVAL '1 month' ELSE INTERVAL '1 year' END))::date,
        CURRENT_DATE
    ),
    t."createdAt",
    CURRENT_TIMESTAMP
FROM "tasks" t
WHERE t."frequency" IS NOT NULL;

-- Their last completion, so "last done" carries over.
INSERT INTO "reminder_completions" ("id", "reminderId", "completedById", "completedAt")
SELECT 'mig_' || t."id", t."id", NULL, t."completedAt"
FROM "tasks" t
WHERE t."frequency" IS NOT NULL AND t."completedAt" IS NOT NULL;

-- Tasks are one-off now; the recurring ones live in reminders.
DELETE FROM "tasks" WHERE "frequency" IS NOT NULL;
