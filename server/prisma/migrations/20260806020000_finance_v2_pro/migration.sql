-- AlterTable Tenant: meta mensal de receita (KPIs)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "monthlyRevenueGoal" DOUBLE PRECISION;

-- CreateTable CommissionPayout
CREATE TABLE IF NOT EXISTS "CommissionPayout" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "barberId" INTEGER NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CAIXA',
    "cashSessionId" INTEGER,
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable AccountMovement
CREATE TABLE IF NOT EXISTS "AccountMovement" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "account" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" INTEGER,
    "counterAccount" TEXT,
    "cashSessionId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable LedgerEntry
CREATE TABLE IF NOT EXISTS "LedgerEntry" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "direction" TEXT NOT NULL,
    "method" TEXT,
    "account" TEXT NOT NULL DEFAULT 'CAIXA',
    "referenceType" TEXT,
    "referenceId" INTEGER,
    "description" TEXT NOT NULL,
    "createdById" INTEGER,
    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable FinanceAuditLog
CREATE TABLE IF NOT EXISTS "FinanceAuditLog" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable FinanceClosing
CREATE TABLE IF NOT EXISTS "FinanceClosing" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER,
    "closedByName" TEXT,
    "snapshot" JSONB NOT NULL,
    "notes" TEXT,
    CONSTRAINT "FinanceClosing_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_commission_payout_tenant" ON "CommissionPayout"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_commission_payout_barber" ON "CommissionPayout"("barberId");
CREATE INDEX IF NOT EXISTS "idx_account_movement_tenant" ON "AccountMovement"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_account_movement_tenant_account" ON "AccountMovement"("tenantId", "account");
CREATE INDEX IF NOT EXISTS "idx_account_movement_date" ON "AccountMovement"("date");
CREATE INDEX IF NOT EXISTS "idx_ledger_entry_tenant" ON "LedgerEntry"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_ledger_entry_tenant_occurred" ON "LedgerEntry"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "idx_ledger_entry_reference" ON "LedgerEntry"("referenceType", "referenceId");
CREATE INDEX IF NOT EXISTS "idx_finance_audit_tenant_created" ON "FinanceAuditLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_finance_closing_tenant" ON "FinanceClosing"("tenantId");

-- Unique: one FinanceClosing per tenant period
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FinanceClosing_tenant_period_key'
  ) THEN
    ALTER TABLE "FinanceClosing"
      ADD CONSTRAINT "FinanceClosing_tenant_period_key"
      UNIQUE ("tenantId", "periodStart", "periodEnd");
  END IF;
END $$;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommissionPayout_tenantId_fkey'
  ) THEN
    ALTER TABLE "CommissionPayout"
      ADD CONSTRAINT "CommissionPayout_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountMovement_tenantId_fkey'
  ) THEN
    ALTER TABLE "AccountMovement"
      ADD CONSTRAINT "AccountMovement_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LedgerEntry_tenantId_fkey'
  ) THEN
    ALTER TABLE "LedgerEntry"
      ADD CONSTRAINT "LedgerEntry_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FinanceAuditLog_tenantId_fkey'
  ) THEN
    ALTER TABLE "FinanceAuditLog"
      ADD CONSTRAINT "FinanceAuditLog_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FinanceClosing_tenantId_fkey'
  ) THEN
    ALTER TABLE "FinanceClosing"
      ADD CONSTRAINT "FinanceClosing_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Partial unique: no more than one OPEN cash session per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "CashSession_one_open_per_tenant"
  ON "CashSession"("tenantId")
  WHERE status = 'OPEN';

-- Nota: Comanda.status é String — PARTIAL (pagamento parcial) não exige ALTER COLUMN.
