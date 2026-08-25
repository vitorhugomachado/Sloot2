const prisma = require('../lib/prisma');
const { getStripe } = require('../lib/stripe');

function subscriptionData(subscription) {
  return {
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items?.data?.[0]?.price?.id || null,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };
}

async function applyEvent(event, tx) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const tenantId = Number(session.metadata?.tenant_id || session.client_reference_id);
    if (Number.isInteger(tenantId) && session.customer) {
      await tx.billingAccount.upsert({
        where: { tenantId },
        create: { tenantId, stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription || null },
        update: { stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription || undefined },
      });
    }
  }
  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object;
    await tx.billingAccount.updateMany({
      where: { stripeCustomerId: subscription.customer },
      data: subscriptionData(subscription),
    });
  }
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    await tx.billingAccount.updateMany({
      where: { stripeCustomerId: invoice.customer },
      data: { status: event.type === 'invoice.paid' ? 'active' : 'past_due' },
    });
  }
}

async function stripeWebhook(req, res) {
  const signature = req.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !webhookSecret) return res.status(400).send('Webhook Stripe não configurado.');
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    return res.status(400).send(`Assinatura inválida: ${error.message}`);
  }
  if (event.livemode && process.env.STRIPE_ALLOW_LIVE_MODE !== 'true') {
    return res.status(400).send('Eventos live mode estão desabilitados.');
  }
  try {
    await prisma.$transaction(async (tx) => {
      const seen = await tx.stripeWebhookEvent.findUnique({ where: { id: event.id } });
      if (seen) return;
      await applyEvent(event, tx);
      await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type, livemode: event.livemode } });
    });
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing error', { eventId: event.id, type: event.type, message: error.message });
    res.status(500).send('Falha ao processar webhook.');
  }
}

module.exports = { stripeWebhook };
