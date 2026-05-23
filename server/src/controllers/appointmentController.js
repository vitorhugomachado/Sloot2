const prisma = require('../lib/prisma');
const { normalizeBookingTime } = require('../utils/appointmentTime');
const { parseDurationMinutes, validateBarberAppointmentSlot } = require('../utils/barberAvailability');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');
const { parseDateRangeFromQuery, parseStaffDateRangeFromQuery, publicBookingDateRange } = require('../lib/bookingHorizon');

const BLOCKING_STATUSES = ['Agendado', 'Confirmado', 'Em progresso'];
const includeBarber = { Barber: { select: { name: true } } };

function appointmentStartDate(existing) {
  const parts = existing.date?.split('-').map(Number);
  if (!parts || parts.length !== 3) return new Date(0);
  const [y, mo, d] = parts;
  const tm = String(existing.time || '00:00').match(/^(\d{1,2}):(\d{2})/);
  const hh = tm ? parseInt(tm[1], 10) : 0;
  const mm = tm ? parseInt(tm[2], 10) : 0;
  return new Date(y, mo - 1, d, hh, mm);
}

const getAppointments = async (req, res) => {
  try {
    const { from, to } = parseStaffDateRangeFromQuery(req.query);
    const where = {
      ...tenantWhere(req),
      date: { gte: from, lte: to },
    };
    if (req.user.role !== 'Gerente') {
      where.barberId = req.user.id;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: includeBarber,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Erro ao buscar agendamentos' });
  }
};

/** Lista mínima para o agendamento público (horários ocupados, sem auth). */
async function fetchPublicAppointments(tenantId, range) {
  const { from, to } = range || publicBookingDateRange();
  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      status: { in: BLOCKING_STATUSES },
      date: { gte: from, lte: to },
    },
    select: { id: true, date: true, time: true, barberId: true, status: true },
  });
  return appointments.map((a) => ({
    ...a,
    time: normalizeBookingTime(a.time) || a.time,
  }));
}

const getPublicAppointments = async (req, res) => {
  try {
    const range = parseDateRangeFromQuery(req.query);
    res.json(await fetchPublicAppointments(tenantIdFromReq(req), range));
  } catch (error) {
    console.error('Error fetching public appointments:', error);
    res.status(500).json({ message: 'Erro ao buscar disponibilidade' });
  }
};

const createAppointment = async (req, res) => {
  try {
    const {
      customer,
      phone,
      service,
      barberId,
      date,
      time,
      price,
    } = req.body || {};

    const normalizedBarberId = Number(barberId);
    const normalizedPrice = Number(price);
    const normalizedTime = normalizeBookingTime(time);

    if (
      !customer ||
      !service ||
      !date ||
      !normalizedTime ||
      !Number.isFinite(normalizedBarberId) ||
      !Number.isFinite(normalizedPrice)
    ) {
      return res.status(400).json({ message: 'Dados obrigatórios do agendamento ausentes ou inválidos' });
    }

    if (req.user && req.user.role === 'Barbeiro' && Number(req.user.id) !== normalizedBarberId) {
      return res.status(403).json({ message: 'Não pode criar agendamento para outro profissional.' });
    }

    const tenantId = tenantIdFromReq(req);
    const barber = await prisma.barber.findFirst({
      where: { id: normalizedBarberId, tenantId, deletedAt: null },
      include: { shifts: true },
    });
    if (!barber) {
      return res.status(400).json({ message: 'Profissional inválido para esta barbearia.' });
    }

    const serviceRow = await prisma.service.findFirst({
      where: { tenantId, name: String(service) },
      select: { duration: true },
    });
    const durationMinutes = parseDurationMinutes(
      req.body?.durationMinutes ?? serviceRow?.duration ?? 30
    );

    const blocks = await prisma.barberScheduleBlock.findMany({
      where: { barberId: normalizedBarberId, date: String(date) },
    });

    const slotCheck = validateBarberAppointmentSlot({
      barber,
      dateIso: String(date),
      time: normalizedTime,
      durationMinutes,
      scheduleBlocks: blocks,
    });
    if (!slotCheck.ok) {
      return res.status(400).json({ message: slotCheck.message });
    }

    let customer_id = null;
    if (req.user?.role === 'customer') {
      customer_id = Number(req.user.id);
    }

    const data = {
      tenantId,
      customer: String(customer),
      phone: phone ? String(phone) : null,
      service: String(service),
      barberId: normalizedBarberId,
      date: String(date),
      time: normalizedTime,
      status: 'Agendado',
      price: normalizedPrice,
      customer_id,
    };

    const appointment = await prisma.appointment.create({
      data,
      include: includeBarber,
    });
    invalidatePublicCache(req.tenantSlug);
    res.status(201).json(appointment);
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      message: 'Erro ao criar agendamento',
      details: process.env.NODE_ENV === 'production' ? undefined : error?.message,
    });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.appointment.findFirst({
      where: { id, ...tenantWhere(req) },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Agendamento não encontrado' });
    }

    if (req.user.role === 'customer') {
      if (Number(existing.customer_id) !== Number(req.user.id)) {
        return res.status(403).json({ message: 'Sem permissão para alterar este agendamento' });
      }

      const payload = {};

      if (req.body.status !== undefined) {
        const s = String(req.body.status);
        if (!['Confirmado', 'Cancelado'].includes(s)) {
          return res.status(400).json({ message: 'Operação não permitida para este agendamento' });
        }
        payload.status = s;
      }

      if (req.body.customer_rating !== undefined) {
        const r = Number(req.body.customer_rating);
        if (!Number.isInteger(r) || r < 1 || r > 5) {
          return res.status(400).json({ message: 'Avaliação inválida (use de 1 a 5 estrelas)' });
        }
        if (existing.status === 'Cancelado' || appointmentStartDate(existing).getTime() >= Date.now()) {
          return res.status(400).json({
            message: 'Só pode avaliar depois do horário marcado e se o agendamento não estiver cancelado'
          });
        }
        payload.customer_rating = r;
      }

      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ message: 'Nenhuma alteração permitida' });
      }

      const appointment = await prisma.appointment.update({
        where: { id },
        data: payload,
        include: includeBarber,
      });
      invalidatePublicCache(req.tenantSlug);
      return res.json(appointment);
    }

    if (req.user.role !== 'Gerente') {
      const isOwnerBarber = Number(existing.barberId) === Number(req.user.id);
      if (!isOwnerBarber) {
        return res.status(403).json({ message: 'Sem permissão para alterar este agendamento' });
      }
    }

    const data = { ...req.body };

    if (req.user.role !== 'Gerente') {
      delete data.barberId;
    }

    delete data.id;
    delete data.barber;
    delete data.Barber;

    // Map camelCase to snake_case if present
    if (data.customerId !== undefined) {
      data.customer_id = data.customerId ? Number(data.customerId) : null;
      delete data.customerId;
    }

    if (data.barberId) data.barberId = Number(data.barberId);
    if (data.price) data.price = parseFloat(data.price);

    const appointment = await prisma.appointment.update({
      where: { id },
      data,
      include: includeBarber,
    });
    invalidatePublicCache(req.tenantSlug);
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar agendamento' });
  }
};

module.exports = {
  getAppointments,
  getPublicAppointments,
  fetchPublicAppointments,
  createAppointment,
  updateAppointment,
};
