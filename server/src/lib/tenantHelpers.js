const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_SLUGS = new Set([
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
]);

function normalizeSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isValidSlug(slug) {
  return slug.length >= 2 && slug.length <= 48 && SLUG_RE.test(slug);
}

function isReservedSlug(slug) {
  return RESERVED_SLUGS.has(normalizeSlug(slug));
}

function getTenantSlugFromRequest(req) {
  const header = req.headers['x-tenant-slug'];
  if (header && String(header).trim()) return normalizeSlug(header);
  if (req.params?.slug) return normalizeSlug(req.params.slug);
  if (req.query?.tenant) return normalizeSlug(req.query.tenant);
  return '';
}

function tenantWhere(req, extra = {}) {
  if (!req.tenant?.id) {
    throw new Error('tenantWhere called without req.tenant');
  }
  return { tenantId: req.tenant.id, ...extra };
}

function tenantIdFromReq(req) {
  return req.tenant.id;
}

function publicTenantShape(tenant) {
  if (!tenant) return null;
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    phone: tenant.phone,
    email: tenant.email,
    address: tenant.address,
    logo_url: tenant.logo_url,
    banner_url: tenant.banner_url,
    tagline: tenant.tagline || '',
    slogan: tenant.slogan || '',
    instagram_url: tenant.instagram_url,
    facebook_url: tenant.facebook_url,
    whatsapp_url: tenant.whatsapp_url,
    show_instagram: tenant.show_instagram,
    show_facebook: tenant.show_facebook,
    show_whatsapp: tenant.show_whatsapp,
  };
}

function getDefaultTenantSlug() {
  return (process.env.DEFAULT_TENANT_SLUG || 'two-brothers').trim().toLowerCase();
}

module.exports = {
  normalizeSlug,
  isValidSlug,
  isReservedSlug,
  RESERVED_SLUGS,
  getTenantSlugFromRequest,
  tenantWhere,
  tenantIdFromReq,
  publicTenantShape,
  getDefaultTenantSlug,
};
