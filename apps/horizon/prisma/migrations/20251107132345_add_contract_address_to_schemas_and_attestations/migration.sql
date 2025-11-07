-- AlterTable
ALTER TABLE "attestations" ADD COLUMN "contractAddress" TEXT NOT NULL DEFAULT 'CDBWGWEZ3P4DZ3YUZSCEUKOVV2UGF2PYQEPW3E5OKNLYS5SNW4SQLDUA';

-- AlterTable
ALTER TABLE "schemas" ADD COLUMN "contractAddress" TEXT NOT NULL DEFAULT 'CDBWGWEZ3P4DZ3YUZSCEUKOVV2UGF2PYQEPW3E5OKNLYS5SNW4SQLDUA';

-- CreateIndex
CREATE INDEX "attestations_contractAddress_idx" ON "attestations"("contractAddress");

-- CreateIndex
CREATE INDEX "schemas_contractAddress_idx" ON "schemas"("contractAddress");
