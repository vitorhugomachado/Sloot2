-- AlterTable Service: commission % for professional
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "commissionPct" DOUBLE PRECISION DEFAULT 50;

-- AlterTable ComandaItem: snapshot + service link
ALTER TABLE "ComandaItem" ADD COLUMN IF NOT EXISTS "serviceId" INTEGER;
ALTER TABLE "ComandaItem" ADD COLUMN IF NOT EXISTS "commissionPct" DOUBLE PRECISION;
