/*
  Warnings:

  - You are about to drop the `event_transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."event_transactions";

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceAccount" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "operationId" TEXT,
    "ledger" INTEGER,
    "eventId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_eventId_key" ON "public"."transactions"("eventId");

-- CreateIndex
CREATE INDEX "transactions_action_idx" ON "public"."transactions"("action");

-- CreateIndex
CREATE INDEX "transactions_transactionHash_idx" ON "public"."transactions"("transactionHash");

-- CreateIndex
CREATE INDEX "transactions_sourceAccount_idx" ON "public"."transactions"("sourceAccount");

-- CreateIndex
CREATE INDEX "transactions_contractId_idx" ON "public"."transactions"("contractId");

-- CreateIndex
CREATE INDEX "transactions_timestamp_idx" ON "public"."transactions"("timestamp");

-- CreateIndex
CREATE INDEX "transactions_ledger_idx" ON "public"."transactions"("ledger");
