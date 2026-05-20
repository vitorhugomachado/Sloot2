/**
 * Cache local (localStorage) para dados públicos — por barbearia (slug).
 */
const PREFIX = 'sloot_v1_';

export const CACHE_TTL = {
  services: 5 * 60 * 1000,
  business: 10 * 60 * 1000,
  barbers: 2 * 60 * 1000,
  appointmentsPublic: 45 * 1000,
};

function storageKey(key, tenantSlug) {
  const slug = String(tenantSlug || 'default').trim().toLowerCase() || 'default';
  return `${PREFIX}${slug}_${key}`;
}

export function readCache(key, ttlMs, tenantSlug) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(key, tenantSlug));
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > ttlMs) {
      localStorage.removeItem(storageKey(key, tenantSlug));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeCache(key, data, tenantSlug) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      storageKey(key, tenantSlug),
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    /* quota exceeded — ignora */
  }
}

export function clearClientDataCache(tenantSlug) {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    const slugPart = tenantSlug ? `${String(tenantSlug).trim().toLowerCase()}_` : null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      if (slugPart == null || k.startsWith(`${PREFIX}${slugPart}`)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Há catálogo mínimo em cache para mostrar UI sem esperar rede. */
export function hasBootstrapCache(tenantSlug) {
  const services = readCache('services', CACHE_TTL.services, tenantSlug);
  const business = readCache('business', CACHE_TTL.business, tenantSlug);
  return Array.isArray(services) && business != null;
}

export function readBootstrapFromCache(tenantSlug) {
  return {
    services: readCache('services', CACHE_TTL.services, tenantSlug),
    businessInfo: readCache('business', CACHE_TTL.business, tenantSlug),
    barbers: readCache('barbers', CACHE_TTL.barbers, tenantSlug),
    appointments: readCache('appointmentsPublic', CACHE_TTL.appointmentsPublic, tenantSlug),
  };
}
