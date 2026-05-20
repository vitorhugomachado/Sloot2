const prisma = require('../lib/prisma.js');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');

const getServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({ where: tenantWhere(req) });
    res.json(services);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ message: 'Erro ao buscar serviços' });
  }
};

const createService = async (req, res) => {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de serviços.' });
  }
  const service = await prisma.service.create({
    data: { ...req.body, tenantId: tenantIdFromReq(req) },
  });
  invalidatePublicCache(req.tenantSlug);
  res.json(service);
};

const updateService = async (req, res) => {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de serviços.' });
  }
  const { id } = req.params;
  const existing = await prisma.service.findFirst({
    where: { id: Number(id), ...tenantWhere(req) },
  });
  if (!existing) return res.status(404).json({ message: 'Serviço não encontrado.' });
  const service = await prisma.service.update({ where: { id: Number(id) }, data: req.body });
  invalidatePublicCache(req.tenantSlug);
  res.json(service);
};

const deleteService = async (req, res) => {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de serviços.' });
  }
  const { id } = req.params;
  const existing = await prisma.service.findFirst({
    where: { id: Number(id), ...tenantWhere(req) },
  });
  if (!existing) return res.status(404).json({ message: 'Serviço não encontrado.' });
  await prisma.service.delete({ where: { id: Number(id) } });
  invalidatePublicCache(req.tenantSlug);
  res.sendStatus(204);
};

module.exports = { getServices, createService, updateService, deleteService };
