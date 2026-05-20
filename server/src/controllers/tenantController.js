const prisma = require('../lib/prisma.js');
const {
  normalizeSlug,
  isValidSlug,
  publicTenantShape,
} = require('../lib/tenantHelpers');

const resolveTenant = async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    if (!isValidSlug(slug)) {
      return res.status(400).json({ message: 'Identificador inválido.' });
    }
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      return res.status(404).json({ message: 'Barbearia não encontrada.' });
    }
    if (tenant.status === 'suspended') {
      return res.status(403).json({ message: 'Barbearia indisponível.' });
    }
    res.json(publicTenantShape(tenant));
  } catch (err) {
    console.error('resolveTenant error:', err);
    res.status(500).json({ message: 'Erro ao resolver barbearia.' });
  }
};

/** GET /business — dados públicos do tenant atual (req.tenant). */
const getTenantBusiness = async (req, res, next) => {
  try {
    res.json(publicTenantShape(req.tenant));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  resolveTenant,
  getTenantBusiness,
};
