CREATE TABLE "billing_accounts" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_accounts_tenantId_key" ON "billing_accounts"("tenantId");
CREATE UNIQUE INDEX "billing_accounts_stripeCustomerId_key" ON "billing_accounts"("stripeCustomerId");
CREATE UNIQUE INDEX "billing_accounts_stripeSubscriptionId_key" ON "billing_accounts"("stripeSubscriptionId");
CREATE INDEX "billing_accounts_status_idx" ON "billing_accounts"("status");
CREATE INDEX "stripe_webhook_events_type_processedAt_idx" ON "stripe_webhook_events"("type", "processedAt");
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
