-- CreateTable
CREATE TABLE "CardFeeRate" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "brand" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "feePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardFeeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_card_fee_rate_tenant" ON "CardFeeRate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CardFeeRate_tenant_brand_kind_key" ON "CardFeeRate"("tenantId", "brand", "kind");

-- AddForeignKey
ALTER TABLE "CardFeeRate" ADD CONSTRAINT "CardFeeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
