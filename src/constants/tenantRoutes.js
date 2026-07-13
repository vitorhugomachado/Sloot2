/** Rotas públicas multi-tenant (/:slug/...). */

export const RESERVED_TENANT_SLUGS = new Set([
  'admin',
  'platform',
  'cadastro',
  'api',
  'health',
  'cliente',
  'barbeiros',
  'login',
  'dashboard',
  'app',
  'portal',
  'configuracoes',
  'www',
  'telateste',
  'telaloginteste',
  'landingteste',
  'paginadevendas',
]);

function norm(slug) {
  return String(slug || '').trim().toLowerCase();
}

export function isReservedTenantSlug(slug) {
  return RESERVED_TENANT_SLUGS.has(norm(slug));
}

/** Primeiro segmento do path do browser (/:slug/...) quando não for reservado. */
export function tenantSlugFromPathname(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (!parts.length) return '';
  const candidate = norm(parts[0]);
  if (!candidate || isReservedTenantSlug(candidate)) return '';
  return candidate;
}

export function tenantBookingPath(slug) {
  const s = norm(slug);
  return s ? `/${s}` : '/';
}

export function tenantLoginPath(slug) {
  return `${tenantBookingPath(slug)}/login`;
}

export function tenantDashboardPath(slug, tab) {
  const base = `${tenantBookingPath(slug)}/dashboard`;
  const t = String(tab || '').trim();
  if (!t || t === 'dashboard') return base;
  return `${base}/${t}`;
}

export function tenantPortalPath(slug) {
  return `${tenantBookingPath(slug)}/portal`;
}

export function tenantResetPasswordPath(slug) {
  return `${tenantBookingPath(slug)}/redefinir-senha`;
}

/** URLs absolutas para o painel /admin (criar barbearia). */
export function tenantPublicUrls(slug, origin = '') {
  const o = typeof origin === 'string' && origin
    ? origin.replace(/\/$/, '')
    : (typeof window !== 'undefined' ? window.location.origin : '');
  const prefix = o || '';
  const booking = `${prefix}${tenantBookingPath(slug)}`;
  return {
    booking,
    cliente: booking,
    staffLogin: `${prefix}${tenantLoginPath(slug)}`,
    staffPanel: `${prefix}${tenantDashboardPath(slug)}`,
  };
}

export function isStaffRoutePath(pathname) {
  return /\/dashboard(\/|$)|\/login$/.test(pathname || '');
}

/**
 * Converte path legado (relativo ao tenant) para a nova rota.
 * @param {string} legacyPath ex. "cliente/portal", "barbeiros/scheduler"
 */
export function mapLegacyTenantPath(legacyPath) {
  const p = String(legacyPath || '').replace(/^\/+/, '');
  if (!p || p === 'cliente') return '';
  if (p === 'cliente/portal' || p.startsWith('cliente/portal/')) return 'portal';
  if (p === 'cliente/redefinir-senha' || p.startsWith('cliente/redefinir-senha')) {
    return 'redefinir-senha';
  }
  if (p.startsWith('cliente/')) return '';
  if (p === 'barbeiros/login' || p === 'barbeiros/login/') return 'login';
  if (p === 'barbeiros' || p === 'barbeiros/') return 'dashboard';
  if (p.startsWith('barbeiros/')) {
    const tab = p.slice('barbeiros/'.length).split('/')[0];
    return tab ? `dashboard/${tab}` : 'dashboard';
  }
  if (p === 'admin' || p.startsWith('admin/')) return 'dashboard';
  return p;
}
