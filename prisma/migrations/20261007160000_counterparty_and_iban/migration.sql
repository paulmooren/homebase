-- AlterTable
ALTER TABLE "financial_accounts" ADD COLUMN "iban" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "counterpartyIban" TEXT,
ADD COLUMN "counterpartyName" TEXT;
