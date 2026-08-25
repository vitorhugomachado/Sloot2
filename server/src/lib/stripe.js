let stripeClient;

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY não configurada.');
  const liveKey = secretKey.startsWith('sk_live_');
  if (liveKey && process.env.STRIPE_ALLOW_LIVE_MODE !== 'true') {
    throw new Error('Chaves Stripe live estão bloqueadas até STRIPE_ALLOW_LIVE_MODE=true.');
  }
  if (!liveKey && !secretKey.startsWith('sk_test_')) {
    throw new Error('Formato de STRIPE_SECRET_KEY inválido.');
  }
  if (!stripeClient) {
    const Stripe = require('stripe');
    stripeClient = new Stripe(secretKey, { appInfo: { name: 'Slooti', version: '1.0.0' } });
  }
  return stripeClient;
}

module.exports = { getStripe };
