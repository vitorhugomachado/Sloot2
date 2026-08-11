-- Fix script: apply finance migration manually
DROP INDEX IF EXISTS "CashSession_tenantId_open_unique";
DROP INDEX IF EXISTS "CashSession_one_open_per_tenant";

DO $$ BEGIN
  CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComandaStatus" AS ENUM ('OPEN', 'PARTIAL', 'QUITADA', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CashSession" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CashSession"
  ALTER COLUMN "status" TYPE "CashSessionStatus"
  USING ("status"::"CashSessionStatus");
ALTER TABLE "CashSession" ALTER COLUMN "status" SET DEFAULT 'OPEN';

ALTER TABLE "Comanda" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Comanda"
  ALTER COLUMN "status" TYPE "ComandaStatus"
  USING ("status"::"ComandaStatus");
ALTER TABLE "Comanda" ALTER COLUMN "status" SET DEFAULT 'OPEN';

CREATE UNIQUE INDEX IF NOT EXISTS "CashSession_tenantId_open_unique"
ON "CashSession" ("tenantId")
WHERE "status" = 'OPEN'::"CashSessionStatus";

CREATE TABLE IF NOT EXISTS "ComandaPayment" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "comandaId" INTEGER NOT NULL,
  "cashSessionId" INTEGER NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'Outro',
  "cardBrand" TEXT,
  "cardKind" TEXT,
  "cardFee" DOUBLE PRECISION,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER,
  CONSTRAINT "ComandaPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_comanda_payment_tenant" ON "ComandaPayment"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_comanda_payment_comanda" ON "ComandaPayment"("comandaId");
CREATE INDEX IF NOT EXISTS "idx_comanda_payment_session" ON "ComandaPayment"("cashSessionId");

DO $$ BEGIN
  ALTER TABLE "ComandaPayment"
    ADD CONSTRAINT "ComandaPayment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComandaPayment"
    ADD CONSTRAINT "ComandaPayment_comandaId_fkey"
    FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComandaPayment"
    ADD CONSTRAINT "ComandaPayment_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "ComandaPayment" (
  "tenantId", "comandaId", "cashSessionId", "amount", "method", "paidAt", "createdById"
)
SELECT
  cm."tenantId", cm."referenceId", cm."cashSessionId", cm."amount", cm."method", cm."createdAt", cm."createdById"
FROM "CashMovement" cm
WHERE cm."referenceType" = 'Comanda'
  AND cm."source" = 'COMANDA'
  AND cm."type" = 'IN'
  AND cm."referenceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ComandaPayment" cp
    WHERE cp."comandaId" = cm."referenceId"
      AND cp."cashSessionId" = cm."cashSessionId"
      AND cp."amount" = cm."amount"
      AND cp."paidAt" = cm."createdAt"
  );
