-- CreateTable
CREATE TABLE "public"."metadata" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contract_events" (
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

    CONSTRAINT "contract_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metadata_key_key" ON "public"."metadata"("key");

-- CreateIndex
CREATE UNIQUE INDEX "contract_events_eventId_key" ON "public"."contract_events"("eventId");

-- CreateIndex
CREATE INDEX "contract_events_ledger_idx" ON "public"."contract_events"("ledger");

-- CreateIndex
CREATE INDEX "contract_events_contractId_idx" ON "public"."contract_events"("contractId");

-- CreateIndex
CREATE INDEX "contract_events_timestamp_idx" ON "public"."contract_events"("timestamp");

-- CreateIndex
CREATE INDEX "contract_events_eventType_idx" ON "public"."contract_events"("eventType");
