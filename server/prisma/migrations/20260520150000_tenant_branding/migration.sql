-- Branding público: banner, tagline e slogan do negócio
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tagline" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "slogan" TEXT;
