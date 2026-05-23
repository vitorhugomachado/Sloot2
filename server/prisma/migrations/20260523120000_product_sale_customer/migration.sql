-- Venda direta: vínculo opcional com cliente e nome avulso
ALTER TABLE "ProductSale" ADD COLUMN IF NOT EXISTS "customerId" INTEGER;
ALTER TABLE "ProductSale" ADD COLUMN IF NOT EXISTS "customerName" TEXT;

CREATE INDEX IF NOT EXISTS "idx_productsale_customer" ON "ProductSale"("customerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductSale_customerId_fkey'
  ) THEN
    ALTER TABLE "ProductSale"
      ADD CONSTRAINT "ProductSale_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
