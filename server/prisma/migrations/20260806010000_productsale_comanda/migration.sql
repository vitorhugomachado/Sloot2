-- AlterTable
ALTER TABLE "ProductSale" ADD COLUMN IF NOT EXISTS "comandaId" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_productsale_comanda" ON "ProductSale"("comandaId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductSale_comandaId_fkey'
  ) THEN
    ALTER TABLE "ProductSale"
      ADD CONSTRAINT "ProductSale_comandaId_fkey"
      FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
