-- CreateTable
CREATE TABLE "horizon_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL,
    "txHash" TEXT,
    "txEnvelope" TEXT NOT NULL,
    "txResult" TEXT NOT NULL,
    "txMeta" TEXT NOT NULL,
    "txFeeBump" BOOLEAN NOT NULL DEFAULT false,
    "txStatus" TEXT NOT NULL,
    "txCreatedAt" TIMESTAMP(3) NOT NULL,
    "inSuccessfulContractCall" TEXT,
    "operationId" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horizon_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horizon_transactions" (
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
CREATE TABLE "horizon_accounts" (
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
CREATE TABLE "horizon_payments" (
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
CREATE TABLE "horizon_operations" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "successful" BOOLEAN NOT NULL DEFAULT true,
    "sourceAccount" TEXT NOT NULL,
    "operationIndex" INTEGER NOT NULL DEFAULT 0,
    "function" TEXT,
    "parameters" JSONB,
    "details" JSONB NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horizon_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horizon_indexer_state" (
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
CREATE TABLE "attestations" (
    "id" TEXT NOT NULL,
    "attestationUid" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "schemaUid" TEXT NOT NULL,
    "attesterAddress" TEXT NOT NULL,
    "subjectAddress" TEXT,
    "transactionHash" TEXT NOT NULL,
    "schemaEncoding" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "value" JSONB,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "contractAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schemas" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "schemaDefinition" TEXT NOT NULL,
    "parsedSchemaDefinition" JSONB,
    "resolverAddress" TEXT,
    "revocable" BOOLEAN NOT NULL DEFAULT true,
    "deployerAddress" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'default',
    "transactionHash" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'default',
    "featured" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
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
CREATE UNIQUE INDEX "horizon_events_eventId_key" ON "horizon_events"("eventId");

-- CreateIndex
CREATE INDEX "horizon_events_ledger_idx" ON "horizon_events"("ledger");

-- CreateIndex
CREATE INDEX "horizon_events_contractId_idx" ON "horizon_events"("contractId");

-- CreateIndex
CREATE INDEX "horizon_events_timestamp_idx" ON "horizon_events"("timestamp");

-- CreateIndex
CREATE INDEX "horizon_events_eventType_idx" ON "horizon_events"("eventType");

-- CreateIndex
CREATE INDEX "horizon_events_txHash_idx" ON "horizon_events"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_transactions_hash_key" ON "horizon_transactions"("hash");

-- CreateIndex
CREATE INDEX "horizon_transactions_ledger_idx" ON "horizon_transactions"("ledger");

-- CreateIndex
CREATE INDEX "horizon_transactions_timestamp_idx" ON "horizon_transactions"("timestamp");

-- CreateIndex
CREATE INDEX "horizon_transactions_sourceAccount_idx" ON "horizon_transactions"("sourceAccount");

-- CreateIndex
CREATE INDEX "horizon_transactions_successful_idx" ON "horizon_transactions"("successful");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_accounts_accountId_key" ON "horizon_accounts"("accountId");

-- CreateIndex
CREATE INDEX "horizon_accounts_isContract_idx" ON "horizon_accounts"("isContract");

-- CreateIndex
CREATE INDEX "horizon_accounts_lastActivity_idx" ON "horizon_accounts"("lastActivity");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_payments_paymentId_key" ON "horizon_payments"("paymentId");

-- CreateIndex
CREATE INDEX "horizon_payments_from_idx" ON "horizon_payments"("from");

-- CreateIndex
CREATE INDEX "horizon_payments_to_idx" ON "horizon_payments"("to");

-- CreateIndex
CREATE INDEX "horizon_payments_timestamp_idx" ON "horizon_payments"("timestamp");

-- CreateIndex
CREATE INDEX "horizon_payments_transactionHash_idx" ON "horizon_payments"("transactionHash");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_operations_operationId_key" ON "horizon_operations"("operationId");

-- CreateIndex
CREATE INDEX "horizon_operations_contractId_idx" ON "horizon_operations"("contractId");

-- CreateIndex
CREATE INDEX "horizon_operations_operationType_idx" ON "horizon_operations"("operationType");

-- CreateIndex
CREATE INDEX "horizon_operations_successful_idx" ON "horizon_operations"("successful");

-- CreateIndex
CREATE INDEX "horizon_operations_sourceAccount_idx" ON "horizon_operations"("sourceAccount");

-- CreateIndex
CREATE INDEX "horizon_operations_transactionHash_idx" ON "horizon_operations"("transactionHash");

-- CreateIndex
CREATE UNIQUE INDEX "attestations_attestationUid_key" ON "attestations"("attestationUid");

-- CreateIndex
CREATE INDEX "attestations_ledger_idx" ON "attestations"("ledger");

-- CreateIndex
CREATE INDEX "attestations_schemaUid_idx" ON "attestations"("schemaUid");

-- CreateIndex
CREATE INDEX "attestations_attesterAddress_idx" ON "attestations"("attesterAddress");

-- CreateIndex
CREATE INDEX "attestations_subjectAddress_idx" ON "attestations"("subjectAddress");

-- CreateIndex
CREATE INDEX "attestations_revoked_idx" ON "attestations"("revoked");

-- CreateIndex
CREATE INDEX "attestations_createdAt_idx" ON "attestations"("createdAt");

-- CreateIndex
CREATE INDEX "attestations_contractAddress_idx" ON "attestations"("contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "schemas_uid_key" ON "schemas"("uid");

-- CreateIndex
CREATE INDEX "schemas_ledger_idx" ON "schemas"("ledger");

-- CreateIndex
CREATE INDEX "schemas_deployerAddress_idx" ON "schemas"("deployerAddress");

-- CreateIndex
CREATE INDEX "schemas_type_idx" ON "schemas"("type");

-- CreateIndex
CREATE INDEX "schemas_createdAt_idx" ON "schemas"("createdAt");

-- CreateIndex
CREATE INDEX "schemas_contractAddress_idx" ON "schemas"("contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_eventId_key" ON "transactions"("eventId");

-- CreateIndex
CREATE INDEX "transactions_action_idx" ON "transactions"("action");

-- CreateIndex
CREATE INDEX "transactions_transactionHash_idx" ON "transactions"("transactionHash");

-- CreateIndex
CREATE INDEX "transactions_sourceAccount_idx" ON "transactions"("sourceAccount");

-- CreateIndex
CREATE INDEX "transactions_contractId_idx" ON "transactions"("contractId");

-- CreateIndex
CREATE INDEX "transactions_timestamp_idx" ON "transactions"("timestamp");

-- CreateIndex
CREATE INDEX "transactions_ledger_idx" ON "transactions"("ledger");

-- AddForeignKey
ALTER TABLE "horizon_events" ADD CONSTRAINT "horizon_events_txHash_fkey" FOREIGN KEY ("txHash") REFERENCES "horizon_transactions"("hash") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horizon_events" ADD CONSTRAINT "horizon_events_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "horizon_operations"("operationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horizon_payments" ADD CONSTRAINT "horizon_payments_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "horizon_transactions"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

