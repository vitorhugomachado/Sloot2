/** Evita bootstrap duplicado no mesmo slug (StrictMode / effects duplos). */
const inflightBySlug = new Map();

export function fetchBootstrapJson(url, headers, tenantSlug) {
  const key = String(tenantSlug || '').toLowerCase() || 'default';
  const existing = inflightBySlug.get(key);
  if (existing) return existing;

  const promise = fetch(url, { headers })
    .then(async (res) => {
      inflightBySlug.delete(key);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Bootstrap falhou (${res.status})`);
      }
      return res.json();
    })
    .catch((err) => {
      inflightBySlug.delete(key);
      throw err;
    });

  inflightBySlug.set(key, promise);
  return promise;
}

export function clearBootstrapInFlight(tenantSlug) {
  const key = String(tenantSlug || '').toLowerCase();
  if (key) inflightBySlug.delete(key);
}
