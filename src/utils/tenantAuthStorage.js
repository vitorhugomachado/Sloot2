/** Tokens de sessão isolados por slug da barbearia (evita vazar two-brothers → lanotic). */

const STAFF_PREFIX = 'barberpro_token:';
const CUSTOMER_PREFIX = 'barberpro_customer_token:';
const LEGACY_STAFF = 'barberpro_token';
const LEGACY_CUSTOMER = 'barberpro_customer_token';

export function decodeTokenTenantId(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const id = Number(json.tenantId);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function tokenMatchesTenant(token, tenantId) {
  if (!tenantId) return true;
  const tid = decodeTokenTenantId(token);
  return tid != null && tid === Number(tenantId);
}

export function getStaffToken(tenantSlug, tenantId) {
  const slug = String(tenantSlug || '').trim().toLowerCase();
  if (!slug) return null;

  const scoped = localStorage.getItem(`${STAFF_PREFIX}${slug}`);
  if (scoped) {
    return tokenMatchesTenant(scoped, tenantId) ? scoped : null;
  }

  const legacy = localStorage.getItem(LEGACY_STAFF);
  if (legacy && tokenMatchesTenant(legacy, tenantId)) {
    localStorage.setItem(`${STAFF_PREFIX}${slug}`, legacy);
    localStorage.removeItem(LEGACY_STAFF);
    return legacy;
  }
  if (legacy && tenantId) localStorage.removeItem(LEGACY_STAFF);
  return null;
}

export function setStaffToken(tenantSlug, token) {
  const slug = String(tenantSlug || '').trim().toLowerCase();
  if (!slug) return;
  if (token) {
    localStorage.setItem(`${STAFF_PREFIX}${slug}`, token);
    const legacy = localStorage.getItem(LEGACY_STAFF);
    if (legacy === token) localStorage.removeItem(LEGACY_STAFF);
  } else {
    localStorage.removeItem(`${STAFF_PREFIX}${slug}`);
  }
}

export function getCustomerToken(tenantSlug, tenantId) {
  const slug = String(tenantSlug || '').trim().toLowerCase();
  if (!slug) return null;

  const scoped = localStorage.getItem(`${CUSTOMER_PREFIX}${slug}`);
  if (scoped) {
    return tokenMatchesTenant(scoped, tenantId) ? scoped : null;
  }

  const legacy = localStorage.getItem(LEGACY_CUSTOMER);
  if (legacy && tokenMatchesTenant(legacy, tenantId)) {
    localStorage.setItem(`${CUSTOMER_PREFIX}${slug}`, legacy);
    localStorage.removeItem(LEGACY_CUSTOMER);
    return legacy;
  }
  if (legacy && tenantId) localStorage.removeItem(LEGACY_CUSTOMER);
  return null;
}

export function setCustomerToken(tenantSlug, token) {
  const slug = String(tenantSlug || '').trim().toLowerCase();
  if (!slug) return;
  if (token) {
    localStorage.setItem(`${CUSTOMER_PREFIX}${slug}`, token);
    const legacy = localStorage.getItem(LEGACY_CUSTOMER);
    if (legacy === token) localStorage.removeItem(LEGACY_CUSTOMER);
  } else {
    localStorage.removeItem(`${CUSTOMER_PREFIX}${slug}`);
  }
}
