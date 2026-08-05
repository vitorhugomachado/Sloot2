-- Finance V2: categories, cash sessions/movements, comandas, expense enrichment

-- AlterTable Expense
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "dueDate" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "competenceDate" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "account" TEXT DEFAULT 'CAIXA';
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "supplier" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "costCenter" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PAID';
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidAt" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "invoiceNote" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "cashSessionId" INTEGER;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;

CREATE TABLE IF NOT EXISTS "FinanceCategory" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slug" TEXT,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CashSession" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" INTEGER,
    "openedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" INTEGER,
    "closedByName" TEXT,
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "countedCash" DOUBLE PRECISION,
    "notes" TEXT,
    "snapshot" JSONB,
    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CashMovement" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "cashSessionId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Outro',
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Comanda" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerId" INTEGER,
    "appointmentId" INTEGER,
    "cashSessionId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "origin" TEXT NOT NULL DEFAULT 'AGENDA',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payments" JSONB,
    "notes" TEXT,
    "barberId" INTEGER,
    "categoryId" INTEGER,
    CONSTRAINT "Comanda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComandaItem" (
    "id" SERIAL NOT NULL,
    "comandaId" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "productId" INTEGER,
    "barberId" INTEGER,
    CONSTRAINT "ComandaItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceCategory_tenant_kind_name_key" ON "FinanceCategory"("tenantId", "kind", "name");
CREATE INDEX IF NOT EXISTS "idx_finance_category_tenant" ON "FinanceCategory"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_finance_category_parent" ON "FinanceCategory"("parentId");

CREATE INDEX IF NOT EXISTS "idx_cash_session_tenant" ON "CashSession"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cash_session_tenant_status" ON "CashSession"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "idx_cash_movement_tenant" ON "CashMovement"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cash_movement_session" ON "CashMovement"("cashSessionId");
CREATE INDEX IF NOT EXISTS "idx_cash_movement_created" ON "CashMovement"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Comanda_appointmentId_key" ON "Comanda"("appointmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Comanda_tenantId_number_key" ON "Comanda"("tenantId", "number");
CREATE INDEX IF NOT EXISTS "idx_comanda_tenant" ON "Comanda"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_comanda_tenant_status" ON "Comanda"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "idx_comanda_opened" ON "Comanda"("openedAt");
CREATE INDEX IF NOT EXISTS "idx_comanda_closed" ON "Comanda"("closedAt");

CREATE INDEX IF NOT EXISTS "idx_comanda_item_comanda" ON "ComandaItem"("comandaId");
CREATE INDEX IF NOT EXISTS "idx_expense_status" ON "Expense"("status");
CREATE INDEX IF NOT EXISTS "idx_expense_due_date" ON "Expense"("dueDate");
CREATE INDEX IF NOT EXISTS "idx_expense_category" ON "Expense"("categoryId");

ALTER TABLE "FinanceCategory" DROP CONSTRAINT IF EXISTS "FinanceCategory_tenantId_fkey";
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceCategory" DROP CONSTRAINT IF EXISTS "FinanceCategory_parentId_fkey";
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashSession" DROP CONSTRAINT IF EXISTS "CashSession_tenantId_fkey";
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashMovement" DROP CONSTRAINT IF EXISTS "CashMovement_tenantId_fkey";
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashMovement" DROP CONSTRAINT IF EXISTS "CashMovement_cashSessionId_fkey";
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comanda" DROP CONSTRAINT IF EXISTS "Comanda_tenantId_fkey";
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comanda" DROP CONSTRAINT IF EXISTS "Comanda_cashSessionId_fkey";
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comanda" DROP CONSTRAINT IF EXISTS "Comanda_categoryId_fkey";
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComandaItem" DROP CONSTRAINT IF EXISTS "ComandaItem_comandaId_fkey";
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_cashSessionId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_categoryId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
