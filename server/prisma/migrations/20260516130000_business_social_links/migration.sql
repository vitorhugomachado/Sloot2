-- AlterTable
ALTER TABLE "BusinessInfo" ADD COLUMN "instagram_url" TEXT;
ALTER TABLE "BusinessInfo" ADD COLUMN "facebook_url" TEXT;
ALTER TABLE "BusinessInfo" ADD COLUMN "whatsapp_url" TEXT;
ALTER TABLE "BusinessInfo" ADD COLUMN "show_instagram" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessInfo" ADD COLUMN "show_facebook" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessInfo" ADD COLUMN "show_whatsapp" BOOLEAN NOT NULL DEFAULT false;
