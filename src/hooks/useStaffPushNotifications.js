import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config/apiUrl';
import {
  getPushEnvironmentBlockReason,
  getStaffPushStatus,
  humanizePushSubscribeError,
  isPushEnvironmentSupported,
  readPushPreference,
  subscriptionToPayload,
  urlBase64ToUint8Array,
  writePushPreference,
} from '../utils/staffPushNotifications';

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
}

export default function useStaffPushNotifications({ apiFetch, tenantSlug, isStaffSession }) {
  const [permission, setPermission] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'default'),
  );
  const [preferenceEnabled, setPreferenceEnabled] = useState(() => readPushPreference(tenantSlug));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const subscriptionRef = useRef(null);

  const supported = isPushEnvironmentSupported();
  const environmentBlockReason = useMemo(() => getPushEnvironmentBlockReason(), []);

  const refreshPermission = useCallback(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const syncExistingSubscription = useCallback(async () => {
    if (!supported || !isStaffSession || !preferenceEnabled) return;

    try {
      const registration = await getServiceWorkerRegistration();
      const existing = await registration.pushManager.getSubscription();
      if (!existing) {
        setPreferenceEnabled(false);
        writePushPreference(tenantSlug, false);
        return;
      }

      subscriptionRef.current = existing;

      const vapidRes = await apiFetch(`${API_URL}/push/vapid-public-key`, { authScope: 'staff' });
      if (!vapidRes.ok) return;

      await apiFetch(`${API_URL}/push/subscribe`, {
        method: 'POST',
        authScope: 'staff',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionToPayload(existing)),
      });
    } catch (syncError) {
      console.warn('Push subscription sync failed:', syncError);
    }
  }, [apiFetch, isStaffSession, preferenceEnabled, supported, tenantSlug]);

  useEffect(() => {
    setPreferenceEnabled(readPushPreference(tenantSlug));
  }, [tenantSlug]);

  useEffect(() => {
    if (!isStaffSession || !preferenceEnabled) return undefined;
    syncExistingSubscription();
    return undefined;
  }, [isStaffSession, preferenceEnabled, syncExistingSubscription]);

  const enable = useCallback(async () => {
    if (!supported) {
      setError(environmentBlockReason || 'Seu navegador não suporta notificações push.');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setError('Permissão de notificação negada pelo navegador.');
        writePushPreference(tenantSlug, false);
        setPreferenceEnabled(false);
        return false;
      }

      const vapidRes = await apiFetch(`${API_URL}/push/vapid-public-key`, { authScope: 'staff' });
      if (!vapidRes.ok) {
        const data = await vapidRes.json().catch(() => ({}));
        throw new Error(data.message || 'Servidor de push indisponível.');
      }

      const { publicKey } = await vapidRes.json();
      if (!publicKey) {
        throw new Error('Chave pública VAPID indisponível.');
      }

      const registration = await getServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      subscriptionRef.current = subscription;

      const saveRes = await apiFetch(`${API_URL}/push/subscribe`, {
        method: 'POST',
        authScope: 'staff',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionToPayload(subscription)),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data.message || 'Não foi possível ativar as notificações.');
      }

      writePushPreference(tenantSlug, true);
      setPreferenceEnabled(true);
      return true;
    } catch (enableError) {
      console.error('enable push notifications failed:', enableError);
      setError(humanizePushSubscribeError(enableError));
      return false;
    } finally {
      setLoading(false);
      refreshPermission();
    }
  }, [apiFetch, environmentBlockReason, refreshPermission, supported, tenantSlug]);

  const disable = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = subscriptionRef.current
        || (registration ? await registration.pushManager.getSubscription() : null);

      if (subscription) {
        const payload = subscriptionToPayload(subscription);
        await apiFetch(`${API_URL}/push/unsubscribe`, {
          method: 'DELETE',
          authScope: 'staff',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await subscription.unsubscribe();
      }

      subscriptionRef.current = null;
      writePushPreference(tenantSlug, false);
      setPreferenceEnabled(false);
      return true;
    } catch (disableError) {
      console.error('disable push notifications failed:', disableError);
      setError(disableError.message || 'Erro ao desativar notificações.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiFetch, tenantSlug]);

  const status = useMemo(
    () => getStaffPushStatus({ supported, permission, preferenceEnabled, loading, error }),
    [supported, permission, preferenceEnabled, loading, error],
  );

  return {
    supported,
    environmentBlockReason,
    permission,
    preferenceEnabled,
    loading,
    error,
    status,
    enable,
    disable,
    refreshPermission,
  };
}
