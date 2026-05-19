-- Fechamento por intervalo de datas (loja inteira ou um barbeiro)
CREATE TABLE "FinancialPeriodClosing" (
    "id" SERIAL NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "barberId" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER,
    "closedByName" TEXT,
    "snapshot" JSONB NOT NULL,
    "notes" TEXT,

    CONSTRAINT "FinancialPeriodClosing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_period_closing_range_scope_barber"
ON "FinancialPeriodClosing"("startDate", "endDate", "scope", "barberId");

CREATE INDEX "idx_period_closing_closed" ON "FinancialPeriodClosing"("closedAt");
