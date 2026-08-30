const prisma = require('../lib/prisma.js');
const { fetchPublicBarbers } = require('./barberController');
const { fetchPublicAppointments } = require('./appointmentController');
const { publicTenantShape, tenantIdFromReq } = require('../lib/tenantHelpers');
const { parseDateRangeFromQuery } = require('../lib/bookingHorizon');
const { buildPublicBookingPage } = require('../lib/bookingPage');

const getPublicBootstrap = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const range = parseDateRangeFromQuery(req.query);
    const [services, barbers, appointments, weeklyHours] = await Promise.all([
      prisma.service.findMany({ where: { tenantId } }),
      fetchPublicBarbers(tenantId, range.from, range.to),
      fetchPublicAppointments(tenantId, range),
      prisma.workingHours.findMany({ where: { tenantId }, orderBy: { dia_semana: 'asc' } }),
    ]);

    res.json({
      services,
      business: {
        ...publicTenantShape(req.tenant),
        bookingPage: buildPublicBookingPage(req.tenant, weeklyHours),
      },
      barbers,
      appointments,
      features: {
        mobileBookingHub: process.env.MOBILE_BOOKING_HUB_ENABLED !== 'false',
      },
    });
  } catch (error) {
    console.error('Public bootstrap error:', error);
    res.status(500).json({ message: 'Erro ao carregar dados públicos' });
  }
};

module.exports = { getPublicBootstrap };
