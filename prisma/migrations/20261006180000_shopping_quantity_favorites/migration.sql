-- AlterTable
ALTER TABLE "shopping_items" ADD COLUMN     "quantity" TEXT;

-- CreateTable
CREATE TABLE "shopping_favorites" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopping_favorites_listId_name_key" ON "shopping_favorites"("listId", "name");

-- AddForeignKey
ALTER TABLE "shopping_favorites" ADD CONSTRAINT "shopping_favorites_listId_fkey" FOREIGN KEY ("listId") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
