-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "durationEstimateMinutes" INTEGER;
ALTER TABLE "jobs" ADD COLUMN "laborCost" REAL;
ALTER TABLE "jobs" ADD COLUMN "partsCost" REAL;
ALTER TABLE "jobs" ADD COLUMN "serviceAreaId" TEXT;
ALTER TABLE "jobs" ADD COLUMN "sourceId" TEXT;
