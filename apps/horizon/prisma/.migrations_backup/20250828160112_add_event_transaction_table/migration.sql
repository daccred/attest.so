-- CreateTable
CREATE TABLE "public"."event_transactions" (
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

    CONSTRAINT "event_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_transactions_eventId_key" ON "public"."event_transactions"("eventId");

-- CreateIndex
CREATE INDEX "event_transactions_action_idx" ON "public"."event_transactions"("action");

-- CreateIndex
CREATE INDEX "event_transactions_transactionHash_idx" ON "public"."event_transactions"("transactionHash");

-- CreateIndex
CREATE INDEX "event_transactions_sourceAccount_idx" ON "public"."event_transactions"("sourceAccount");

-- CreateIndex
CREATE INDEX "event_transactions_contractId_idx" ON "public"."event_transactions"("contractId");

-- CreateIndex
CREATE INDEX "event_transactions_timestamp_idx" ON "public"."event_transactions"("timestamp");

-- CreateIndex
CREATE INDEX "event_transactions_ledger_idx" ON "public"."event_transactions"("ledger");
