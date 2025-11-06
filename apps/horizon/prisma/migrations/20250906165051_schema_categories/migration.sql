-- AlterTable
ALTER TABLE "public"."schemas" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;
