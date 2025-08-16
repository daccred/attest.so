-- AlterTable
ALTER TABLE "public"."horizon_events" ADD COLUMN     "contractOperationId" TEXT;

-- CreateTable
CREATE TABLE "public"."horizon_contract_operations" (
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

    CONSTRAINT "horizon_contract_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "horizon_contract_operations_operationId_key" ON "public"."horizon_contract_operations"("operationId");

-- CreateIndex
CREATE INDEX "horizon_contract_operations_contractId_idx" ON "public"."horizon_contract_operations"("contractId");

-- CreateIndex
CREATE INDEX "horizon_contract_operations_operationType_idx" ON "public"."horizon_contract_operations"("operationType");

-- CreateIndex
CREATE INDEX "horizon_contract_operations_successful_idx" ON "public"."horizon_contract_operations"("successful");

-- CreateIndex
CREATE INDEX "horizon_contract_operations_sourceAccount_idx" ON "public"."horizon_contract_operations"("sourceAccount");

-- CreateIndex
CREATE INDEX "horizon_contract_operations_transactionHash_idx" ON "public"."horizon_contract_operations"("transactionHash");

-- AddForeignKey
ALTER TABLE "public"."horizon_events" ADD CONSTRAINT "horizon_events_contractOperationId_fkey" FOREIGN KEY ("contractOperationId") REFERENCES "public"."horizon_contract_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."horizon_contract_operations" ADD CONSTRAINT "horizon_contract_operations_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "public"."horizon_transactions"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;
