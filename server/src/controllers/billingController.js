const prisma = require('../lib/prisma');
const { getStripe } = require('../lib/stripe');

function allowedPrices() {
  return new Set([process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_ANNUAL].filter(Boolean));
}

function appUrl() {
  const value = process.env.FRONTEND_URL?.trim();
  if (!value) throw new Error('FRONTEND_URL não configurada.');
  return value.replace(/\/$/, '');
}

async function getOrCreateCustomer(tenant) {
  const existing = await prisma.billingAccount.findUnique({ where: { tenantId: tenant.id } });
  if (existing) return existing;
  const customer = await getStripe().customers.create({
    name: tenant.name,
    email: tenant.email || undefined,
    phone: tenant.phone || undefined,
    metadata: { tenant_id: String(tenant.id), tenant_slug: tenant.slug },
  });
  return prisma.billingAccount.create({
    data: { tenantId: tenant.id, stripeCustomerId: customer.id },
  });
}

async function createCheckoutSession(req, res) {
  const { priceId } = req.body || {};
  if (!allowedPrices().has(priceId)) {
    return res.status(400).json({ message: 'Plano Stripe inválido ou não configurado.' });
  }
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 255) {
    return res.status(400).json({ message: 'Envie um Idempotency-Key válido.' });
  }
  try {
    const account = await getOrCreateCustomer(req.tenant);
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: account.stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}/${req.tenant.slug}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/${req.tenant.slug}/settings?billing=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: String(req.tenant.id),
      metadata: { tenant_id: String(req.tenant.id) },
      subscription_data: { metadata: { tenant_id: String(req.tenant.id) } },
    }, { idempotencyKey: `checkout:${req.tenant.id}:${idempotencyKey}` });
    res.status(201).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout error', { tenantId: req.tenant.id, type: error.type, requestId: error.requestId });
    res.status(502).json({ message: 'Não foi possível iniciar o checkout.' });
  }
}

async function createPortalSession(req, res) {
  try {
    const account = await prisma.billingAccount.findUnique({ where: { tenantId: req.tenant.id } });
    if (!account) return res.status(404).json({ message: 'Cliente de cobrança ainda não criado.' });
    const session = await getStripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${appUrl()}/${req.tenant.slug}/settings`,
    });
    res.status(201).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Portal error', { tenantId: req.tenant.id, type: error.type, requestId: error.requestId });
    res.status(502).json({ message: 'Não foi possível abrir o portal de cobrança.' });
  }
}

async function getBillingStatus(req, res) {
  const account = await prisma.billingAccount.findUnique({ where: { tenantId: req.tenant.id } });
  res.json(account ? {
    status: account.status,
    priceId: account.stripePriceId,
    currentPeriodEnd: account.currentPeriodEnd,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
  } : { status: 'inactive' });
}

module.exports = { createCheckoutSession, createPortalSession, getBillingStatus };
