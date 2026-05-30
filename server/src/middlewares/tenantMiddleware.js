const prisma = require('../lib/prisma.js');
const {
  getTenantSlugFromRequest,
  isValidSlug,
  publicTenantShape,
} = require('../lib/tenantHelpers');

async function resolveTenantBySlug(slug) {
  if (!slug || !isValidSlug(slug)) return null;
  return prisma.tenant.findUnique({ where: { slug } });
}

/** Exige barbearia válida (header X-Tenant-Slug ou :slug na rota). */
async function requireTenant(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  try {
    const slug = getTenantSlugFromRequest(req);
    if (!slug) {
      return res.status(400).json({
        message: 'Barbearia não indicada. Use o header X-Tenant-Slug ou o slug na URL.',
      });
    }
    if (!isValidSlug(slug)) {
      return res.status(400).json({ message: 'Identificador da barbearia inválido.' });
    }

    const tenant = await resolveTenantBySlug(slug);
    if (!tenant) {
      return res.status(404).json({ message: 'Barbearia não encontrada.' });
    }
    if (tenant.status === 'suspended') {
      return res.status(403).json({ message: 'Esta barbearia está temporariamente indisponível.' });
    }

    req.tenant = tenant;
    req.tenantSlug = tenant.slug;
    next();
  } catch (err) {
    console.error('requireTenant error:', err);
    res.status(500).json({ message: 'Erro ao resolver barbearia.' });
  }
}

/** Garante que o JWT pertence ao mesmo tenant da requisição. */
function requireTenantAuthMatch(req, res, next) {
  if (!req.user) return next();
  if (req.user.type === 'platform') return next();

  const tokenTenantId = Number(req.user.tenantId);
  if (!Number.isFinite(tokenTenantId) || tokenTenantId !== req.tenant.id) {
    return res.status(403).json({ message: 'Sessão não pertence a esta barbearia.' });
  }
  next();
}

module.exports = {
  requireTenant,
  requireTenantAuthMatch,
  resolveTenantBySlug,
  publicTenantShape,
};
