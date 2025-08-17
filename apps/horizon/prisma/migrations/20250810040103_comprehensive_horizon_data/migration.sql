/*
  Warnings:

  - You are about to drop the `contract_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `metadata` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."contract_events";

-- DropTable
DROP TABLE "public"."metadata";

-- CreateTable
CREATE TABLE "public"."horizon_metadata" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horizon_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."horizon_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL,
    "txHash" TEXT NOT NULL,
    "txEnvelope" TEXT NOT NULL,
    "txResult" TEXT NOT NULL,
    "txMeta" TEXT NOT NULL,
    "txFeeBump" BOOLEAN NOT NULL DEFAULT false,
    "txStatus" TEXT NOT NULL,
    "txCreatedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horizon_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."horizon_transactions" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceAccount" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "operationCount" INTEGER NOT NULL,
    "envelope" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "meta" JSONB NOT NULL,
    "feeBump" BOOLEAN NOT NULL DEFAULT false,
    "successful" BOOLEAN NOT NULL,
    "memo" TEXT,
    "memoType" TEXT,
    "inclusionFee" TEXT,
    "resourceFee" TEXT,
    "sorobanResourceUsage" JSONB,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horizon_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."horizon_operations" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "operationIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "typeI" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "sourceAccount" TEXT,
    "contractId" TEXT,
    "function" TEXT,
    "parameters" JSONB,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horizon_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."horizon_effects" (
    "id" TEXT NOT NULL,
    "effectId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "typeI" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "account" TEXT,
    "eventId" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horizon_effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."horizon_contract_data" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "durability" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "previousValue" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horizon_contract_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."horizon_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sequence" TEXT NOT NULL,
    "balances" JSONB NOT NULL,
    "signers" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "flags" INTEGER NOT NULL,
    "homeDomain" TEXT,
    "thresholds" JSONB NOT NULL,
    "isContract" BOOLEAN NOT NULL DEFAULT false,
    "contractCode" TEXT,
    "operationCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horizon_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."horizon_payments" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "asset" JSONB NOT NULL,
    "amount" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horizon_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."horizon_indexer_state" (
    "id" TEXT NOT NULL,
    "lastProcessedLedger" INTEGER NOT NULL,
    "lastProcessedAt" TIMESTAMP(3) NOT NULL,
    "syncStatus" TEXT NOT NULL,
    "errorMessage" TEXT,
    "eventsPerSecond" DOUBLE PRECISION,
    "ledgersPerMinute" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horizon_indexer_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_HorizonEventToHorizonOperation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_HorizonEventToHorizonOperation_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "horizon_metadata_key_key" ON "public"."horizon_metadata"("key");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_events_eventId_key" ON "public"."horizon_events"("eventId");

-- CreateIndex
CREATE INDEX "horizon_events_ledger_idx" ON "public"."horizon_events"("ledger");

-- CreateIndex
CREATE INDEX "horizon_events_contractId_idx" ON "public"."horizon_events"("contractId");

-- CreateIndex
CREATE INDEX "horizon_events_timestamp_idx" ON "public"."horizon_events"("timestamp");

-- CreateIndex
CREATE INDEX "horizon_events_eventType_idx" ON "public"."horizon_events"("eventType");

-- CreateIndex
CREATE INDEX "horizon_events_txHash_idx" ON "public"."horizon_events"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_transactions_hash_key" ON "public"."horizon_transactions"("hash");

-- CreateIndex
CREATE INDEX "horizon_transactions_ledger_idx" ON "public"."horizon_transactions"("ledger");

-- CreateIndex
CREATE INDEX "horizon_transactions_timestamp_idx" ON "public"."horizon_transactions"("timestamp");

-- CreateIndex
CREATE INDEX "horizon_transactions_sourceAccount_idx" ON "public"."horizon_transactions"("sourceAccount");

-- CreateIndex
CREATE INDEX "horizon_transactions_successful_idx" ON "public"."horizon_transactions"("successful");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_operations_operationId_key" ON "public"."horizon_operations"("operationId");

-- CreateIndex
CREATE INDEX "horizon_operations_transactionHash_idx" ON "public"."horizon_operations"("transactionHash");

-- CreateIndex
CREATE INDEX "horizon_operations_type_idx" ON "public"."horizon_operations"("type");

-- CreateIndex
CREATE INDEX "horizon_operations_contractId_idx" ON "public"."horizon_operations"("contractId");

-- CreateIndex
CREATE INDEX "horizon_operations_sourceAccount_idx" ON "public"."horizon_operations"("sourceAccount");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_effects_effectId_key" ON "public"."horizon_effects"("effectId");

-- CreateIndex
CREATE INDEX "horizon_effects_operationId_idx" ON "public"."horizon_effects"("operationId");

-- CreateIndex
CREATE INDEX "horizon_effects_transactionHash_idx" ON "public"."horizon_effects"("transactionHash");

-- CreateIndex
CREATE INDEX "horizon_effects_type_idx" ON "public"."horizon_effects"("type");

-- CreateIndex
CREATE INDEX "horizon_effects_account_idx" ON "public"."horizon_effects"("account");

-- CreateIndex
CREATE INDEX "horizon_contract_data_contractId_idx" ON "public"."horizon_contract_data"("contractId");

-- CreateIndex
CREATE INDEX "horizon_contract_data_ledger_idx" ON "public"."horizon_contract_data"("ledger");

-- CreateIndex
CREATE INDEX "horizon_contract_data_timestamp_idx" ON "public"."horizon_contract_data"("timestamp");

-- CreateIndex
CREATE INDEX "horizon_contract_data_durability_idx" ON "public"."horizon_contract_data"("durability");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_contract_data_contractId_key_ledger_key" ON "public"."horizon_contract_data"("contractId", "key", "ledger");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_accounts_accountId_key" ON "public"."horizon_accounts"("accountId");

-- CreateIndex
CREATE INDEX "horizon_accounts_isContract_idx" ON "public"."horizon_accounts"("isContract");

-- CreateIndex
CREATE INDEX "horizon_accounts_lastActivity_idx" ON "public"."horizon_accounts"("lastActivity");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_payments_paymentId_key" ON "public"."horizon_payments"("paymentId");

-- CreateIndex
CREATE INDEX "horizon_payments_from_idx" ON "public"."horizon_payments"("from");

-- CreateIndex
CREATE INDEX "horizon_payments_to_idx" ON "public"."horizon_payments"("to");

-- CreateIndex
CREATE INDEX "horizon_payments_timestamp_idx" ON "public"."horizon_payments"("timestamp");

-- CreateIndex
CREATE INDEX "horizon_payments_transactionHash_idx" ON "public"."horizon_payments"("transactionHash");

-- CreateIndex
CREATE INDEX "_HorizonEventToHorizonOperation_B_index" ON "public"."_HorizonEventToHorizonOperation"("B");

-- AddForeignKey
ALTER TABLE "public"."horizon_events" ADD CONSTRAINT "horizon_events_txHash_fkey" FOREIGN KEY ("txHash") REFERENCES "public"."horizon_transactions"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."horizon_operations" ADD CONSTRAINT "horizon_operations_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "public"."horizon_transactions"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."horizon_effects" ADD CONSTRAINT "horizon_effects_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "public"."horizon_operations"("operationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."horizon_effects" ADD CONSTRAINT "horizon_effects_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "public"."horizon_transactions"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."horizon_effects" ADD CONSTRAINT "horizon_effects_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."horizon_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."horizon_payments" ADD CONSTRAINT "horizon_payments_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "public"."horizon_transactions"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_HorizonEventToHorizonOperation" ADD CONSTRAINT "_HorizonEventToHorizonOperation_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."horizon_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_HorizonEventToHorizonOperation" ADD CONSTRAINT "_HorizonEventToHorizonOperation_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."horizon_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
