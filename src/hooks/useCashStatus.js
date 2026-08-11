import { useCallback, useEffect, useState } from 'react';
import { CASH_STATUS_CHANGED } from '../utils/cashStatusEvents';

/**
 * Status do caixa aberto (por tenant) com refresh automático.
 */
export function useCashStatus(financeV2, { pollMs = 20000, enabled = true } = {}) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && financeV2?.getCurrentCash));

  const refresh = useCallback(async () => {
    if (!enabled || !financeV2?.getCurrentCash) {
      setSession(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await financeV2.getCurrentCash();
      const next = res?.session || null;
      setSession(next);
      return next;
    } catch {
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, financeV2]);

  useEffect(() => {
    if (!enabled) {
      setSession(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    refresh().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !pollMs || !financeV2?.getCurrentCash) return undefined;
    const id = setInterval(() => {
      refresh();
    }, pollMs);
    return () => clearInterval(id);
  }, [enabled, pollMs, financeV2, refresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onFocus = () => {
      refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onCashChanged = () => {
      refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(CASH_STATUS_CHANGED, onCashChanged);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(CASH_STATUS_CHANGED, onCashChanged);
    };
  }, [enabled, refresh]);

  return {
    session,
    isOpen: Boolean(session?.id),
    loading,
    refresh,
  };
}
