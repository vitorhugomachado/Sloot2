-- CreateTable
CREATE TABLE "MonthClosing" (
    "id" SERIAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER,
    "closedByName" TEXT,
    "snapshot" JSONB NOT NULL,
    "notes" TEXT,

    CONSTRAINT "MonthClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthClosing_yearMonth_key" ON "MonthClosing"("yearMonth");

-- CreateIndex
CREATE INDEX "idx_monthclosing_year_month" ON "MonthClosing"("yearMonth");
