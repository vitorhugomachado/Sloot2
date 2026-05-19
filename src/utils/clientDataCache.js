/**
 * Cache local (localStorage) para dados públicos — primeira visita mais rápida ao voltar.
 */
const PREFIX = 'sloot_v1_';

export const CACHE_TTL = {
  services: 5 * 60 * 1000,
  business: 10 * 60 * 1000,
  barbers: 2 * 60 * 1000,
  appointmentsPublic: 45 * 1000,
};

function storageKey(key) {
  return `${PREFIX}${key}`;
}

export function readCache(key, ttlMs) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > ttlMs) {
      localStorage.removeItem(storageKey(key));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeCache(key, data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      storageKey(key),
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    /* quota exceeded — ignora */
  }
}

export function clearClientDataCache() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Há catálogo mínimo em cache para mostrar UI sem esperar rede. */
export function hasBootstrapCache() {
  const services = readCache('services', CACHE_TTL.services);
  const business = readCache('business', CACHE_TTL.business);
  return Array.isArray(services) && business != null;
}

export function readBootstrapFromCache() {
  return {
    services: readCache('services', CACHE_TTL.services),
    businessInfo: readCache('business', CACHE_TTL.business),
    barbers: readCache('barbers', CACHE_TTL.barbers),
    appointments: readCache('appointmentsPublic', CACHE_TTL.appointmentsPublic),
  };
}
