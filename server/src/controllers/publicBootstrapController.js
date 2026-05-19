const { PrismaClient } = require('@prisma/client');
const { fetchPublicBarbers } = require('./barberController');
const { fetchPublicAppointments } = require('./appointmentController');

const prisma = new PrismaClient();

const getPublicBootstrap = async (req, res) => {
  try {
    const [services, business, barbers, appointments] = await Promise.all([
      prisma.service.findMany(),
      prisma.businessInfo.findUnique({ where: { id: 1 } }),
      fetchPublicBarbers(),
      fetchPublicAppointments(),
    ]);

    res.json({
      services,
      business,
      barbers,
      appointments,
    });
  } catch (error) {
    console.error('Public bootstrap error:', error);
    res.status(500).json({ message: 'Erro ao carregar dados públicos' });
  }
};

module.exports = { getPublicBootstrap };
