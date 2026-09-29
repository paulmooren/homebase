-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringSource" AS ENUM ('MANUAL', 'DETECTED');

-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'DISMISSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "recurring_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "categoryId" TEXT,
    "source" "RecurringSource" NOT NULL,
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_items_userId_status_idx" ON "recurring_items"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_items_userId_name_key" ON "recurring_items"("userId", "name");

-- AddForeignKey
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
