-- DropForeignKey
ALTER TABLE "public"."horizon_events" DROP CONSTRAINT "horizon_events_txHash_fkey";

-- AlterTable
ALTER TABLE "public"."horizon_events" ALTER COLUMN "txHash" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."horizon_events" ADD CONSTRAINT "horizon_events_txHash_fkey" FOREIGN KEY ("txHash") REFERENCES "public"."horizon_transactions"("hash") ON DELETE SET NULL ON UPDATE CASCADE;
