const prisma = require('../lib/prisma.js');
const { fetchPublicBarbers } = require('./barberController');
const { fetchPublicAppointments } = require('./appointmentController');
const { publicTenantShape, tenantIdFromReq } = require('../lib/tenantHelpers');
const { parseDateRangeFromQuery } = require('../lib/bookingHorizon');

const getPublicBootstrap = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const range = parseDateRangeFromQuery(req.query);
    const [services, barbers, appointments] = await Promise.all([
      prisma.service.findMany({ where: { tenantId } }),
      fetchPublicBarbers(tenantId, range.from, range.to),
      fetchPublicAppointments(tenantId, range),
    ]);

    res.json({
      services,
      business: publicTenantShape(req.tenant),
      barbers,
      appointments,
    });
  } catch (error) {
    console.error('Public bootstrap error:', error);
    res.status(500).json({ message: 'Erro ao carregar dados públicos' });
  }
};

module.exports = { getPublicBootstrap };
