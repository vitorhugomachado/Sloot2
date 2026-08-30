const prisma = require('../lib/prisma.js');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');
const { normalizeServiceBookingIcon } = require('../lib/serviceBookingIcons');

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
  const { name, price, duration, commissionPct, bookingIcon } = req.body;
  const normalizedBookingIcon = normalizeServiceBookingIcon(bookingIcon);
  if (!normalizedBookingIcon) {
    return res.status(400).json({ message: 'Ícone de agendamento inválido.' });
  }
  const pct = commissionPct != null && commissionPct !== ''
    ? Math.max(0, Math.min(100, Number(commissionPct)))
    : 50;
  const service = await prisma.service.create({
    data: {
      name: String(name || '').trim(),
      price: Number(price || 0),
      duration: String(duration || '30 min'),
      bookingIcon: normalizedBookingIcon,
      commissionPct: Number.isFinite(pct) ? pct : 50,
      tenantId: tenantIdFromReq(req),
    },
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

  const data = {};
  if (req.body.name != null) data.name = String(req.body.name).trim();
  if (req.body.price != null) data.price = Number(req.body.price);
  if (req.body.duration != null) data.duration = String(req.body.duration);
  if (req.body.bookingIcon != null) {
    const bookingIcon = normalizeServiceBookingIcon(req.body.bookingIcon, existing.bookingIcon || 'generic');
    if (!bookingIcon) return res.status(400).json({ message: 'Ícone de agendamento inválido.' });
    data.bookingIcon = bookingIcon;
  }
  if (req.body.commissionPct != null && req.body.commissionPct !== '') {
    const pct = Math.max(0, Math.min(100, Number(req.body.commissionPct)));
    data.commissionPct = Number.isFinite(pct) ? pct : existing.commissionPct;
  }

  const service = await prisma.service.update({ where: { id: Number(id) }, data });
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
