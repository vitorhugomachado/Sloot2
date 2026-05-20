-- Compatibilidade: containers antigos ainda chamam prisma.businessInfo (id=1).
-- Dados espelhados do tenant principal; código novo usa apenas Tenant.

CREATE TABLE IF NOT EXISTS "BusinessInfo" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "logo_url" TEXT,
  "instagram_url" TEXT,
  "facebook_url" TEXT,
  "whatsapp_url" TEXT,
  "show_instagram" BOOLEAN NOT NULL DEFAULT false,
  "show_facebook" BOOLEAN NOT NULL DEFAULT false,
  "show_whatsapp" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "BusinessInfo_pkey" PRIMARY KEY ("id")
);

INSERT INTO "BusinessInfo" (
  "id",
  "name",
  "phone",
  "email",
  "address",
  "logo_url",
  "instagram_url",
  "facebook_url",
  "whatsapp_url",
  "show_instagram",
  "show_facebook",
  "show_whatsapp"
)
SELECT
  1,
  t."name",
  t."phone",
  t."email",
  t."address",
  t."logo_url",
  t."instagram_url",
  t."facebook_url",
  t."whatsapp_url",
  t."show_instagram",
  t."show_facebook",
  t."show_whatsapp"
FROM "Tenant" t
ORDER BY t."id"
LIMIT 1
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "phone" = EXCLUDED."phone",
  "email" = EXCLUDED."email",
  "address" = EXCLUDED."address",
  "logo_url" = EXCLUDED."logo_url",
  "instagram_url" = EXCLUDED."instagram_url",
  "facebook_url" = EXCLUDED."facebook_url",
  "whatsapp_url" = EXCLUDED."whatsapp_url",
  "show_instagram" = EXCLUDED."show_instagram",
  "show_facebook" = EXCLUDED."show_facebook",
  "show_whatsapp" = EXCLUDED."show_whatsapp";

INSERT INTO "BusinessInfo" ("id", "name", "phone", "email", "address")
SELECT 1, 'SLOOT', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM "BusinessInfo");
