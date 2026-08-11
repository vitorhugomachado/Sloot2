-- Garante no máximo um CashSession OPEN por tenant (Postgres partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS "CashSession_tenantId_open_unique"
ON "CashSession" ("tenantId")
WHERE "status" = 'OPEN';
