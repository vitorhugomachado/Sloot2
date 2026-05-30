ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "enabledModules" JSONB NOT NULL DEFAULT '["dashboard","scheduler","clients","finance","users","inventory","settings"]'::jsonb;
