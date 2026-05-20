-- Multi-tenant: Tenant table, tenantId on domain tables, backfill default tenant.

-- 1) Tenant table
CREATE TABLE "Tenant" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "logo_url" TEXT,
  "instagram_url" TEXT,
  "facebook_url" TEXT,
  "whatsapp_url" TEXT,
  "show_instagram" BOOLEAN NOT NULL DEFAULT false,
  "show_facebook" BOOLEAN NOT NULL DEFAULT false,
  "show_whatsapp" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- 2) Seed default tenant from BusinessInfo (if exists)
INSERT INTO "Tenant" (
  "slug", "name", "phone", "email", "address",
  "logo_url", "instagram_url", "facebook_url", "whatsapp_url",
  "show_instagram", "show_facebook", "show_whatsapp"
)
SELECT
  'two-brothers',
  COALESCE(NULLIF(TRIM("name"), ''), 'Two Brothers'),
  COALESCE("phone", ''),
  COALESCE("email", ''),
  COALESCE("address", ''),
  "logo_url",
  "instagram_url",
  "facebook_url",
  "whatsapp_url",
  COALESCE("show_instagram", false),
  COALESCE("show_facebook", false),
  COALESCE("show_whatsapp", false)
FROM "BusinessInfo"
WHERE EXISTS (SELECT 1 FROM "BusinessInfo" LIMIT 1)
LIMIT 1;

INSERT INTO "Tenant" ("slug", "name")
SELECT 'two-brothers', 'Two Brothers'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant");

-- 3) Add tenantId columns (nullable during backfill)
ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "ProductSale" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "MonthClosing" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
ALTER TABLE "FinancialPeriodClosing" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'barber_schedule_blocks') THEN
    ALTER TABLE "barber_schedule_blocks" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;
  END IF;
END $$;

-- 4) Backfill tenantId = default tenant
UPDATE "Barber" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Customer" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Service" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Appointment" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Product" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "ProductSale" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "Expense" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "MonthClosing" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;
UPDATE "FinancialPeriodClosing" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1) WHERE "tenantId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'barber_schedule_blocks' AND column_name = 'tenantId') THEN
    EXECUTE 'UPDATE "barber_schedule_blocks" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = ''two-brothers'' LIMIT 1) WHERE "tenantId" IS NULL';
  END IF;
END $$;

-- 5) NOT NULL + FKs
ALTER TABLE "Barber" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ProductSale" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "MonthClosing" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "FinancialPeriodClosing" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Barber" ADD CONSTRAINT "Barber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthClosing" ADD CONSTRAINT "MonthClosing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialPeriodClosing" ADD CONSTRAINT "FinancialPeriodClosing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'barber_schedule_blocks' AND column_name = 'tenantId') THEN
    ALTER TABLE "barber_schedule_blocks" ALTER COLUMN "tenantId" SET NOT NULL;
    ALTER TABLE "barber_schedule_blocks" ADD CONSTRAINT "barber_schedule_blocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 6) Drop global uniques, add tenant-scoped uniques
DROP INDEX IF EXISTS "Barber_email_key";
DROP INDEX IF EXISTS "Customer_email_key";
DROP INDEX IF EXISTS "MonthClosing_yearMonth_key";

CREATE UNIQUE INDEX "Barber_tenantId_email_key" ON "Barber"("tenantId", "email");
CREATE UNIQUE INDEX "Customer_tenantId_email_key" ON "Customer"("tenantId", "email");
CREATE UNIQUE INDEX "MonthClosing_tenantId_yearMonth_key" ON "MonthClosing"("tenantId", "yearMonth");

CREATE INDEX "idx_barber_tenant" ON "Barber"("tenantId");
CREATE INDEX "idx_customer_tenant" ON "Customer"("tenantId");
CREATE INDEX "idx_service_tenant" ON "Service"("tenantId");
CREATE INDEX "idx_appointment_tenant" ON "Appointment"("tenantId");
CREATE INDEX "idx_product_tenant" ON "Product"("tenantId");
CREATE INDEX "idx_productsale_tenant" ON "ProductSale"("tenantId");
CREATE INDEX "idx_expense_tenant" ON "Expense"("tenantId");
CREATE INDEX "idx_monthclosing_tenant" ON "MonthClosing"("tenantId");
CREATE INDEX "idx_period_closing_tenant" ON "FinancialPeriodClosing"("tenantId");

-- 7) horarios_funcionamento: add tenantId to PK
DO $$
DECLARE
  default_tenant INTEGER;
BEGIN
  SELECT "id" INTO default_tenant FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'horarios_funcionamento') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'horarios_funcionamento' AND column_name = 'tenantId'
    ) THEN
      ALTER TABLE "horarios_funcionamento" ADD COLUMN "tenantId" INTEGER;
      UPDATE "horarios_funcionamento" SET "tenantId" = default_tenant WHERE "tenantId" IS NULL;
      ALTER TABLE "horarios_funcionamento" ALTER COLUMN "tenantId" SET NOT NULL;

      ALTER TABLE "horarios_funcionamento" DROP CONSTRAINT IF EXISTS "horarios_funcionamento_pkey";
      ALTER TABLE "horarios_funcionamento" ADD CONSTRAINT "horarios_funcionamento_pkey" PRIMARY KEY ("tenantId", "dia_semana");
      ALTER TABLE "horarios_funcionamento" ADD CONSTRAINT "horarios_funcionamento_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- 8) feriados: tenant-scoped unique
DO $$
DECLARE
  default_tenant INTEGER;
BEGIN
  SELECT "id" INTO default_tenant FROM "Tenant" WHERE "slug" = 'two-brothers' LIMIT 1;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feriados') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name = 'feriados' AND column_name = 'tenantId'
    ) THEN
      ALTER TABLE "feriados" ADD COLUMN "tenantId" INTEGER;
      UPDATE "feriados" SET "tenantId" = default_tenant WHERE "tenantId" IS NULL;
      ALTER TABLE "feriados" ALTER COLUMN "tenantId" SET NOT NULL;
      ALTER TABLE "feriados" ADD CONSTRAINT "feriados_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS "Holiday_tenantId_data_key" ON "feriados"("tenantId", "data");
  END IF;
END $$;

-- 9) Drop BusinessInfo (data lives on Tenant)
DROP TABLE IF EXISTS "BusinessInfo";
