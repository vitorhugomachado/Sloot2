const prisma = require('../lib/prisma');
const { HEAVY_TX } = require('../lib/prisma');
const { normalizeBookingTime, isBookingSlotInPast, getLocalDateIso } = require('../utils/appointmentTime');
const { parseDurationMinutes, validateBarberAppointmentSlot } = require('../utils/barberAvailability');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');
const { parseDateRangeFromQuery, parseStaffDateRangeFromQuery, publicBookingDateRange } = require('../lib/bookingHorizon');
const { scheduleNewAppointmentPush } = require('../services/appointmentPushService');
const { findBookableProfessional } = require('../lib/bookableProfessionals');
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
  assertPeriodNotClosed,
  computePayableTotal,
  sumComandaPaidAmount,
} = require('../lib/financeV2');

const IN_SERVICE_STATUSES = new Set(['Em progresso', 'Em atendimento']);

const BLOCKING_STATUSES = ['Agendado', 'Confirmado', 'Em progresso'];
const includeBarber = { Barber: { select: { name: true } } };

class AppointmentSlotConflictError extends Error {
  constructor() {
    super('Este horário acabou de ser ocupado. Escolha outro horário.');
    this.code = 'SLOT_TAKEN';
  }
}

function timeToMinutes(value) {
  const normalized = normalizeBookingTime(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

function slotsOverlap(firstTime, firstDuration, secondTime, secondDuration) {
  const firstStart = timeToMinutes(firstTime);
  const secondStart = timeToMinutes(secondTime);
  if (firstStart == null || secondStart == null) return false;
  return firstStart < secondStart + parseDurationMinutes(secondDuration)
    && secondStart < firstStart + parseDurationMinutes(firstDuration);
}

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
    const barber = await findBookableProfessional(prisma, tenantId, normalizedBarberId);
    if (!barber) {
      return res.status(400).json({ message: 'Profissional indisponível para agendamentos nesta barbearia.' });
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

    const appointment = await prisma.$transaction(async (tx) => {
      // Serializa alterações da agenda deste profissional/dia. Isso impede que
      // dois navegadores passem pela checagem antes de qualquer insert existir.
      const lockKey = `booking:${tenantId}:${normalizedBarberId}:${String(date)}`;
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const existing = await tx.appointment.findMany({
        where: {
          tenantId,
          barberId: normalizedBarberId,
          date: String(date),
          status: { in: BLOCKING_STATUSES },
        },
        select: { service: true, time: true },
      });
      const serviceNames = [...new Set([String(service), ...existing.map((item) => item.service)])];
      const durations = await tx.service.findMany({
        where: { tenantId, name: { in: serviceNames } },
        select: { name: true, duration: true },
      });
      const durationByService = new Map(durations.map((item) => [item.name, item.duration]));
      const hasConflict = existing.some((item) => slotsOverlap(
        normalizedTime,
        durationMinutes,
        item.time,
        durationByService.get(item.service) || 30,
      ));
      if (hasConflict) throw new AppointmentSlotConflictError();

      return tx.appointment.create({ data, include: includeBarber });
    });
    invalidatePublicCache(req.tenantSlug);
    scheduleNewAppointmentPush({
      req,
      appointment,
      tenantSlug: req.tenantSlug,
    });
    res.status(201).json(appointment);
  } catch (error) {
    if (error instanceof AppointmentSlotConflictError || error?.code === 'SLOT_TAKEN') {
      return res.status(409).json({ code: 'SLOT_TAKEN', message: error.message });
    }
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
    const finalPaymentsPreview = data.payments;
    const isPartialCheckout =
      Boolean(finalPaymentsPreview?.allowPartial)
      && Array.isArray(finalPaymentsPreview?.splits)
      && finalPaymentsPreview.splits.length > 0
      && !isFinalizing;

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
        }, HEAVY_TX);
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

    if (isFinalizing || isPartialCheckout) {
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

      if (isPartialCheckout) {
        delete data.status;
      }

      const tenantId = tenantIdFromReq(req);
      const finalPayments = data.payments;
      const allowPartial = Boolean(finalPayments?.allowPartial);
      const cashSessionId = finalPayments?.cashSessionId ?? data.cashSessionId;
      delete data.cashSessionId;

      try {
        await assertPeriodNotClosed(tenantId, paidAt);
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
          const itemsTotal = items.reduce((s, i) => s + Number(i.total || 0), 0);
          const payableMeta = computePayableTotal(itemsTotal, finalPayments);
          const total = payableMeta.payable;
          const splits = Array.isArray(finalPayments?.splits) ? finalPayments.splits : [];
          const splitSum = splits.reduce((s, p) => s + Number(p.amount || 0), 0);
          const alreadyPartial = String(comanda.status).toUpperCase() === 'PARTIAL';

          if (!(splitSum > 0)) {
            const err = new Error('Informe ao menos um pagamento com valor.');
            err.code = 'PAYMENT_MISMATCH';
            err.status = 400;
            throw err;
          }

          if (!allowPartial && !alreadyPartial) {
            validatePaymentSplits(splits, total);
          } else if (!alreadyPartial && allowPartial && splitSum > total + 0.01) {
            const err = new Error(
              `Pagamento (R$ ${splitSum.toFixed(2)}) excede o total (R$ ${total.toFixed(2)}).`,
            );
            err.code = 'PAYMENT_OVER';
            err.status = 400;
            throw err;
          } else if (alreadyPartial) {
            const alreadyPaid = await sumComandaPaidAmount(tx, tenantId, comanda.id);
            const remaining = Math.round((total - alreadyPaid) * 100) / 100;
            if (splitSum > remaining + 0.01) {
              const err = new Error(
                `Pagamento (R$ ${splitSum.toFixed(2)}) excede o saldo (R$ ${remaining.toFixed(2)}).`,
              );
              err.code = 'PAYMENT_OVER';
              err.status = 400;
              throw err;
            }
          }

          const alreadyPaidBefore = await sumComandaPaidAmount(tx, tenantId, comanda.id);
          const newPaidTotal = Math.round((alreadyPaidBefore + splitSum) * 100) / 100;
          const isFull = newPaidTotal >= total - 0.01;
          const willBePartial = !isFull && (allowPartial || alreadyPartial);

          if (!isFull && !allowPartial && !alreadyPartial) {
            const err = new Error(
              `Total pago (R$ ${splitSum.toFixed(2)}) deve igualar o total (R$ ${total.toFixed(2)}).`,
            );
            err.code = 'PAYMENT_MISMATCH';
            err.status = 400;
            throw err;
          }

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

            const stockAlreadyApplied = Boolean(
              alreadyPartial
              && (await tx.productSale.count({ where: { tenantId, comandaId: comanda.id } })) > 0,
            );
            if (isFull && !stockAlreadyApplied) {
              await applyProductStockFromItems(tx, {
                tenantId,
                items,
                barberId: updated.barberId || null,
                customerId: updated.customer_id || null,
                customerName: updated.customer,
                saleDate: paidAt || toLocalDateIso(new Date()),
                comandaId: comanda.id,
              });
            }

            const enrichedSplits = await enrichCardSplits(
              tx,
              tenantId,
              splits,
            );
            const feeMeta = allocateCardFeesToBarbers(
              enrichedSplits,
              items,
              updated.barberId || null,
            );

            const prevPayments = (typeof comanda.payments === 'object' && comanda.payments)
              ? comanda.payments
              : {};
            const prevSplits = Array.isArray(prevPayments.splits) ? prevPayments.splits : [];
            const allSplits = [...prevSplits, ...enrichedSplits];
            const paymentPayload = {
              ...finalPayments,
              splits: allSplits,
              cashSessionId: cashSession.id,
              itemsTotal: payableMeta.itemsTotal,
              discountAmount: payableMeta.discount,
              tipAmount: payableMeta.tip,
              totalCheckout: total,
              paidAmount: newPaidTotal,
              cardFeeTotal: feeMeta.cardFeeTotal,
              cardFeeByBarber: feeMeta.cardFeeByBarber,
              allowPartial: willBePartial || undefined,
            };

            await settleComandaInTx(tx, {
              tenantId,
              comandaId: comanda.id,
              cashSession,
              payments: paymentPayload,
              splitsToRecord: enrichedSplits,
              userId: req.user?.id,
              description: `Comanda Nº — ${updated.customer} (${updated.service})`,
              totalOverride: total,
              status: willBePartial ? 'PARTIAL' : 'QUITADA',
            });

            if (isFull) {
              await tx.appointment.update({
                where: { id },
                data: { status: 'Finalizado' },
              });
              updated.status = 'Finalizado';
            }
          }

          return updated;
        }, HEAVY_TX);

        invalidatePublicCache(req.tenantSlug);
        return res.json(appointment);
      } catch (settleErr) {
        console.error(settleErr);
        if (
          settleErr?.code === 'CASH_REQUIRED'
          || settleErr?.code === 'CASH_CLOSED'
          ||           settleErr?.code === 'PAYMENT_MISMATCH'
          || settleErr?.code === 'PAYMENT_OVER'
          || settleErr?.code === 'STOCK_INSUFFICIENT'
          || settleErr?.code === 'PRODUCT_NOT_FOUND'
          || settleErr?.code === 'PRODUCT_REQUIRED'
          ||           settleErr?.code === 'CARD_BRAND_REQUIRED'
          || settleErr?.code === 'CARD_KIND_REQUIRED'
          || settleErr?.code === 'PERIOD_CLOSED'
        ) {
          return res.status(settleErr.status || 409).json({
            message: settleErr.message,
            code: settleErr.code,
          });
        }
        if (settleErr?.code === 'P2028') {
          return res.status(503).json({
            message: 'Demorou demais para gravar no financeiro. Tente novamente.',
            code: 'P2028',
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
