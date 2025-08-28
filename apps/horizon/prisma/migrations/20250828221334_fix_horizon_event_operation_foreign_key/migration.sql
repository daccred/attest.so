-- DropForeignKey
ALTER TABLE "public"."attestations" DROP CONSTRAINT "attestations_schemaUid_fkey";

-- DropForeignKey
ALTER TABLE "public"."horizon_events" DROP CONSTRAINT "horizon_events_operationId_fkey";

-- AddForeignKey
ALTER TABLE "public"."horizon_events" ADD CONSTRAINT "horizon_events_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "public"."horizon_operations"("operationId") ON DELETE SET NULL ON UPDATE CASCADE;
