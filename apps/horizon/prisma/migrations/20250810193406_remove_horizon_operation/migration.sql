/*
  Warnings:

  - You are about to drop the `_HorizonEventToHorizonOperation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `horizon_operations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."_HorizonEventToHorizonOperation" DROP CONSTRAINT "_HorizonEventToHorizonOperation_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_HorizonEventToHorizonOperation" DROP CONSTRAINT "_HorizonEventToHorizonOperation_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."horizon_effects" DROP CONSTRAINT "horizon_effects_operationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."horizon_operations" DROP CONSTRAINT "horizon_operations_transactionHash_fkey";

-- DropTable
DROP TABLE "public"."_HorizonEventToHorizonOperation";

-- DropTable
DROP TABLE "public"."horizon_operations";
