const prisma = require('../lib/prisma');
const { normalizeBookingTime, isBookingSlotInPast, getLocalDateIso } = require('../utils/appointmentTime');
const { parseDurationMinutes, validateBarberAppointmentSlot } = require('../utils/barberAvailability');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');
const { parseDateRangeFromQuery, parseStaffDateRangeFromQuery, publicBookingDateRange } = require('../lib/bookingHorizon');
const { scheduleNewAppointmentPush } = require('../services/appointmentPushService');
const {
  getSalesIncomeCategoryId,
  settleComandaInTx,
  ensureFinanceCategories,
  ensureOpenComandaForAppointment,
  cancelOpenComandaForAppointment,
  resolveOpenCashSession,
  validatePaymentSplits,
  applyProductStockFromItems,
  resolveServiceCommissionMeta,
  toLocalDateIso,
  enrichCardSplits,
  allocateCardFeesToBarbers,
} = require('../lib/financeV2');

const IN_SERVICE_STATUSES = new Set(['Em progresso', 'Em atendimento']);

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

    if (isBookingSlotInPast(String(date), normalizedTime)) {
      return res.status(400).json({ message: 'Não é possível agendar em um horário que já passou.' });
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
    } else if (req.body.customerId != null && req.body.customerId !== '') {
      const linked = Number(req.body.customerId);
      if (Number.isFinite(linked) && linked > 0) customer_id = linked;
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
    scheduleNewAppointmentPush({
      req,
      appointment,
      tenantSlug: req.tenantSlug,
    });
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

      const tenantId = tenantIdFromReq(req);
      const appointment = await prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.update({
          where: { id },
          data: payload,
          include: includeBarber,
        });
        if (payload.status === 'Cancelado') {
          await cancelOpenComandaForAppointment(tx, { tenantId, appointmentId: id });
        }
        return updated;
      });
      invalidatePublicCache(req.tenantSlug);
      return res.json(appointment);
    }

    if (req.user.role !== 'Gerente' && req.user.role !== 'Barbeiro') {
      return res.status(403).json({ message: 'Sem permissão para alterar este agendamento' });
    }

    const data = { ...req.body };

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

    const nextStatus = String(data.status || existing.status || '');
    const isStartingService =
      IN_SERVICE_STATUSES.has(nextStatus) && !IN_SERVICE_STATUSES.has(String(existing.status || ''));
    const isFinalizing =
      nextStatus === 'Finalizado' && existing.status !== 'Finalizado';

    if (isStartingService) {
      const tenantId = tenantIdFromReq(req);
      try {
        await ensureFinanceCategories(tenantId);
        const categoryId = await getSalesIncomeCategoryId(tenantId);
        const appointment = await prisma.$transaction(async (tx) => {
          const updated = await tx.appointment.update({
            where: { id },
            data,
            include: includeBarber,
          });
          await ensureOpenComandaForAppointment(tx, {
            tenantId,
            appointment: updated,
            categoryId,
          });
          return updated;
        });
        invalidatePublicCache(req.tenantSlug);
        return res.json(appointment);
      } catch (startErr) {
        console.error(startErr);
        if (startErr?.code === 'P2002') {
          const appointment = await prisma.appointment.update({
            where: { id },
            data,
            include: includeBarber,
          });
          invalidatePublicCache(req.tenantSlug);
          return res.json(appointment);
        }
        return res.status(500).json({ message: 'Erro ao abrir comanda do atendimento' });
      }
    }

    if (isFinalizing) {
      const paidAt = getLocalDateIso();
      let payments = data.payments !== undefined ? data.payments : existing.payments;
      if (payments && typeof payments === 'object' && !Array.isArray(payments)) {
        if (!payments.paidAt) {
          data.payments = { ...payments, paidAt };
        }
      } else if (data.payments === undefined && payments && typeof payments === 'object' && !Array.isArray(payments)) {
        data.payments = { ...payments, paidAt };
      } else if (!payments) {
        data.payments = { paidAt };
      }

      const tenantId = tenantIdFromReq(req);
      const finalPayments = data.payments;
      const cashSessionId = finalPayments?.cashSessionId ?? data.cashSessionId;
      delete data.cashSessionId;

      try {
        await ensureFinanceCategories(tenantId);
        const categoryId = await getSalesIncomeCategoryId(tenantId);

        const appointment = await prisma.$transaction(async (tx) => {
          const cashSession = await resolveOpenCashSession(tenantId, cashSessionId, tx);

          const updated = await tx.appointment.update({
            where: { id },
            data,
            include: includeBarber,
          });

          let comanda = await ensureOpenComandaForAppointment(tx, {
            tenantId,
            appointment: updated,
            categoryId,
          });

          const productItems = Array.isArray(finalPayments?.products)
            ? finalPayments.products.map((p) => ({
                itemType: 'PRODUCT',
                name: String(p.name || 'Produto'),
                quantity: Math.max(1, Number(p.quantity || 1)),
                unitPrice: Number(p.unitPrice || 0),
                total: Number(p.subtotal != null ? p.subtotal : Number(p.unitPrice || 0) * Number(p.quantity || 1)),
                productId: p.id ? Number(p.id) : null,
                barberId: updated.barberId || null,
                commissionPct: null,
                serviceId: null,
              }))
            : [];

          const serviceTotal = Number(
            finalPayments?.serviceTotal != null ? finalPayments.serviceTotal : updated.price || 0,
          );
          const serviceMeta = await resolveServiceCommissionMeta(tx, {
            tenantId,
            serviceName: updated.service,
            barberId: updated.barberId,
          });
          const items = [
            {
              itemType: 'SERVICE',
              name: String(updated.service || 'Serviço'),
              quantity: 1,
              unitPrice: serviceTotal,
              total: serviceTotal,
              barberId: updated.barberId || null,
              serviceId: serviceMeta.serviceId,
              commissionPct: serviceMeta.commissionPct,
            },
            ...productItems,
          ];
          const total = Number(
            finalPayments?.totalCheckout != null
              ? finalPayments.totalCheckout
              : items.reduce((s, i) => s + Number(i.total || 0), 0),
          );

          validatePaymentSplits(finalPayments?.splits, total);

          if (comanda.status !== 'QUITADA') {
            await tx.comandaItem.deleteMany({ where: { comandaId: comanda.id } });
            comanda = await tx.comanda.update({
              where: { id: comanda.id },
              data: {
                total,
                customerName: updated.customer,
                barberId: updated.barberId || null,
                categoryId: comanda.categoryId || categoryId,
                items: { create: items },
              },
              include: { items: true },
            });

            await applyProductStockFromItems(tx, {
              tenantId,
              items,
              barberId: updated.barberId || null,
              customerId: updated.customer_id || null,
              customerName: updated.customer,
              saleDate: paidAt || toLocalDateIso(new Date()),
              comandaId: comanda.id,
            });

            const enrichedSplits = await enrichCardSplits(
              tx,
              tenantId,
              Array.isArray(finalPayments?.splits) ? finalPayments.splits : [],
            );
            const feeMeta = allocateCardFeesToBarbers(
              enrichedSplits,
              items,
              updated.barberId || null,
            );

            await settleComandaInTx(tx, {
              tenantId,
              comandaId: comanda.id,
              cashSession,
              payments: {
                ...finalPayments,
                splits: enrichedSplits,
                cashSessionId: cashSession.id,
                totalCheckout: total,
                cardFeeTotal: feeMeta.cardFeeTotal,
                cardFeeByBarber: feeMeta.cardFeeByBarber,
              },
              userId: req.user?.id,
              description: `Comanda Nº — ${updated.customer} (${updated.service})`,
              totalOverride: total,
            });
          }

          return updated;
        });

        invalidatePublicCache(req.tenantSlug);
        return res.json(appointment);
      } catch (settleErr) {
        console.error(settleErr);
        if (
          settleErr?.code === 'CASH_REQUIRED'
          || settleErr?.code === 'CASH_CLOSED'
          || settleErr?.code === 'PAYMENT_MISMATCH'
          || settleErr?.code === 'STOCK_INSUFFICIENT'
          || settleErr?.code === 'PRODUCT_NOT_FOUND'
          || settleErr?.code === 'CARD_BRAND_REQUIRED'
          || settleErr?.code === 'CARD_KIND_REQUIRED'
        ) {
          return res.status(settleErr.status || 409).json({
            message: settleErr.message,
            code: settleErr.code,
          });
        }
        return res.status(500).json({ message: 'Erro ao contabilizar comanda no financeiro' });
      }
    }

    const isCancelling =
      nextStatus === 'Cancelado' && existing.status !== 'Cancelado';

    if (isCancelling) {
      const tenantId = tenantIdFromReq(req);
      const appointment = await prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.update({
          where: { id },
          data,
          include: includeBarber,
        });
        await cancelOpenComandaForAppointment(tx, { tenantId, appointmentId: id });
        return updated;
      });
      invalidatePublicCache(req.tenantSlug);
      return res.json(appointment);
    }

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
