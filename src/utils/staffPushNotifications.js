const PUSH_PREF_PREFIX = 'sloot_push_enabled_';

function isPushEnvironmentSupported() {
  return (
    typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  );
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
  readPushPreference,
  writePushPreference,
  urlBase64ToUint8Array,
  subscriptionToPayload,
};
