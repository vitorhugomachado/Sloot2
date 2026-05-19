/**
 * Cache em memória para GETs públicos (catálogo, negócio, agenda pública).
 * Reduz carga no Supabase e acelera respostas repetidas.
 */
const store = new Map();

const DEFAULT_TTL_SEC = 90;

function cacheKey(req) {
  return req.originalUrl || req.url;
}

function cachePublic(ttlSec = DEFAULT_TTL_SEC) {
  const ttlMs = ttlSec * 1000;
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const key = cacheKey(req);
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) {
      res.set('Cache-Control', `public, max-age=${ttlSec}, stale-while-revalidate=30`);
      res.set('X-Cache', 'HIT');
      return res.json(hit.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      store.set(key, { body, expires: Date.now() + ttlMs });
      res.set('Cache-Control', `public, max-age=${ttlSec}, stale-while-revalidate=30`);
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };
    next();
  };
}

function invalidatePublicCache() {
  store.clear();
}

module.exports = { cachePublic, invalidatePublicCache };
