const prisma = require('../lib/prisma.js');

/** Loads req.tenant from :id for platform admin routes (ignores suspension). */
async function requirePlatformTenant(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID da barbearia inválido.' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ message: 'Barbearia não encontrada.' });
    }

    req.tenant = tenant;
    req.tenantSlug = tenant.slug;
    next();
  } catch (err) {
    console.error('requirePlatformTenant error:', err);
    res.status(500).json({ message: 'Erro ao resolver barbearia.' });
  }
}

module.exports = requirePlatformTenant;
