-- AlterTable
ALTER TABLE "attestations" ADD COLUMN "contractAddress" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "schemas" ADD COLUMN "contractAddress" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "attestations_contractAddress_idx" ON "attestations"("contractAddress");

-- CreateIndex
CREATE INDEX "schemas_contractAddress_idx" ON "schemas"("contractAddress");
