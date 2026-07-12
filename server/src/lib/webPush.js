const webpush = require('web-push');

let configured = false;

function configureWebPush() {
  if (configured) {
    return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@slooti.com.br';

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

function isWebPushConfigured() {
  return configureWebPush();
}

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function toWebPushSubscription(row) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function sendPushNotification(subscriptionRow, payload) {
  if (!isWebPushConfigured()) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  try {
    await webpush.sendNotification(
      toWebPushSubscription(subscriptionRow),
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (error) {
    const statusCode = error?.statusCode;
    return {
      ok: false,
      statusCode,
      expired: statusCode === 404 || statusCode === 410,
      error,
    };
  }
}

module.exports = {
  isWebPushConfigured,
  getVapidPublicKey,
  sendPushNotification,
};
