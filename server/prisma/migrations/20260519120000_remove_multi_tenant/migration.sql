-- Revert multi-tenant: remove tenantId columns and Tenant table (single-barbershop model).

-- 1) Resolve duplicate emails before global UNIQUE constraints
UPDATE "Customer" c
SET email = NULL
FROM (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(email))
        ORDER BY id
      ) AS rn
    FROM "Customer"
    WHERE email IS NOT NULL
  ) ranked
  WHERE rn > 1
) dupes
WHERE c.id = dupes.id;

UPDATE "MonthClosing" mc
SET "yearMonth" = mc."yearMonth" || '_dedup_' || mc.id::text
FROM (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "yearMonth"
        ORDER BY id
      ) AS rn
    FROM "MonthClosing"
  ) ranked
  WHERE rn > 1
) dupes
WHERE mc.id = dupes.id;

-- 2) Drop foreign keys to Tenant
ALTER TABLE "Barber" DROP CONSTRAINT IF EXISTS "Barber_tenantId_fkey";
ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS "Customer_tenantId_fkey";
ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_tenantId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_tenantId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_tenantId_fkey";
ALTER TABLE "ProductSale" DROP CONSTRAINT IF EXISTS "ProductSale_tenantId_fkey";
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_tenantId_fkey";
ALTER TABLE "MonthClosing" DROP CONSTRAINT IF EXISTS "MonthClosing_tenantId_fkey";
ALTER TABLE "FinancialPeriodClosing" DROP CONSTRAINT IF EXISTS "FinancialPeriodClosing_tenantId_fkey";

-- 3) Drop composite uniques involving tenantId
DROP INDEX IF EXISTS "Barber_tenantId_email_key";
DROP INDEX IF EXISTS "Customer_tenantId_email_key";
DROP INDEX IF EXISTS "MonthClosing_tenantId_yearMonth_key";

-- 4) Drop tenantId columns
ALTER TABLE "Barber" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "ProductSale" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Expense" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "MonthClosing" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "FinancialPeriodClosing" DROP COLUMN IF EXISTS "tenantId";

-- 5) Global uniques (single-tenant)
CREATE UNIQUE INDEX IF NOT EXISTS "Barber_email_key" ON "Barber"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_email_key" ON "Customer"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "MonthClosing_yearMonth_key" ON "MonthClosing"("yearMonth");

-- 6) Remove Tenant table
DROP TABLE IF EXISTS "Tenant";
