const PUSH_PREF_PREFIX = 'sloot_push_enabled_';

function isPushEnvironmentSupported() {
  return (
    typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  );
}

function getPushEnvironmentBlockReason() {
  if (typeof window === 'undefined') return 'Ambiente indisponível.';
  if (!window.isSecureContext) {
    const host = window.location.hostname;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host)) {
      return 'Contexto inseguro para push. Abra o Slooti em http://localhost:5173.';
    }
    return `Push exige HTTPS ou localhost. Você está em ${window.location.origin} — no desenvolvimento use http://localhost:5173 no PC (não o IP da rede, ex. 192.168.x.x).`;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'Seu navegador não suporta notificações push. Use Chrome ou Edge atualizado.';
  }
  return null;
}

function humanizePushSubscribeError(error) {
  const msg = String(error?.message || error || '').toLowerCase();

  if (msg.includes('push service not available')) {
    return [
      'Serviço de push do navegador indisponível.',
      'No PC: abra http://localhost:5173 (não o IP 192.168.x.x).',
      'Confirme notificações ativas no Windows e use Chrome ou Edge atualizado.',
    ].join(' ');
  }

  if (msg.includes('registration failed')) {
    return 'Falha ao registrar push. Use localhost ou HTTPS e permita notificações no navegador.';
  }

  return error?.message || 'Erro ao ativar notificações.';
}

function pushPrefKey(tenantSlug) {
  return `${PUSH_PREF_PREFIX}${tenantSlug || 'default'}`;
}

function readPushPreference(tenantSlug) {
  try {
    return localStorage.getItem(pushPrefKey(tenantSlug)) === '1';
  } catch {
    return false;
  }
}

function writePushPreference(tenantSlug, enabled) {
  try {
    if (enabled) localStorage.setItem(pushPrefKey(tenantSlug), '1');
    else localStorage.removeItem(pushPrefKey(tenantSlug));
  } catch {
    // ignore
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function subscriptionToPayload(subscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  };
}

export function getStaffPushStatus({ supported, permission, preferenceEnabled, loading, error }) {
  if (!supported) return 'unsupported';
  if (permission === 'denied') return 'denied';
  if (loading) return 'loading';
  if (error) return 'error';
  if (preferenceEnabled && permission === 'granted') return 'enabled';
  return 'disabled';
}

export {
  isPushEnvironmentSupported,
  getPushEnvironmentBlockReason,
  humanizePushSubscribeError,
  readPushPreference,
  writePushPreference,
  urlBase64ToUint8Array,
  subscriptionToPayload,
};
