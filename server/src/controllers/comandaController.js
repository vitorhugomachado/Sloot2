const prisma = require('../lib/prisma.js');
const { tenantIdFromReq } = require('../lib/tenantHelpers');
const {
  getSalesIncomeCategoryId,
  nextComandaNumber,
  settleComandaInTx,
  ensureFinanceCategories,
  resolveOpenCashSession,
  brazilDayBounds,
  comandaSettlementDate,
  reverseSettleComandaInTx,
  applyProductStockFromItems,
  validatePaymentSplits,
  resolveServiceCommissionMeta,
  toLocalDateIso,
} = require('../lib/financeV2');

function parseDateBound(start, end, field = 'openedAt') {
  const bounds = brazilDayBounds(start, end);
  if (!bounds) return {};
  return { [field]: bounds };
}

const listComandas = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;
    const q = String(req.query.q || '').trim();

    const where = {
      tenantId,
      ...(status && status !== 'QUITADA' ? { status } : {}),
      ...(status && status !== 'QUITADA'
        ? parseDateBound(start, end, 'openedAt')
        : {}),
      ...(q
        ? {
            OR: [
              { customerName: { contains: q, mode: 'insensitive' } },
              ...(Number.isFinite(Number(q)) ? [{ number: Number(q) }] : []),
            ],
          }
        : {}),
    };

    let comandas = await prisma.comanda.findMany({
      where: status === 'QUITADA' ? { ...where, status: 'QUITADA' } : where,
      include: {
        items: true,
        cashSession: { select: { id: true, openedAt: true, openedByName: true, status: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 200,
    });

    if (status === 'QUITADA' && (start || end || q)) {
      comandas = comandas.filter((c) => {
        const d = comandaSettlementDate(c);
        if (start && d < start) return false;
        if (end && d > end) return false;
        if (q) {
          const qq = q.toLowerCase();
          const matchName = String(c.customerName || '').toLowerCase().includes(qq);
          const matchNum = String(c.number) === q;
          if (!matchName && !matchNum) return false;
        }
        return true;
      });
    } else if (!status && (start || end)) {
      comandas = comandas.filter((c) => {
        if (c.status === 'QUITADA') {
          const d = comandaSettlementDate(c);
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        }
        const opened = c.openedAt ? new Date(c.openedAt) : null;
        if (!opened) return true;
        const bounds = brazilDayBounds(start, end);
        if (bounds?.gte && opened < bounds.gte) return false;
        if (bounds?.lte && opened > bounds.lte) return false;
        return true;
      });
    }

    res.json(comandas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar comandas' });
  }
};

const getComanda = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const comanda = await prisma.comanda.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        cashSession: { select: { id: true, openedAt: true, openedByName: true, status: true } },
      },
    });
    if (!comanda) return res.status(404).json({ error: 'Comanda não encontrada' });
    res.json(comanda);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar comanda' });
  }
};

async function mapItemsWithCommission(tx, tenantId, itemsInput, defaultBarberId) {
  const items = [];
  for (const item of itemsInput) {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Number(item.unitPrice || item.price || 0);
    const itemType = String(item.itemType || item.type || 'SERVICE').toUpperCase();
    const name = String(item.name || 'Item');
    const barberId = item.barberId ? Number(item.barberId) : (defaultBarberId || null);
    let serviceId = item.serviceId ? Number(item.serviceId) : null;
    let commissionPct = null;

    if (itemType === 'SERVICE') {
      const meta = await resolveServiceCommissionMeta(tx, {
        tenantId,
        serviceId,
        serviceName: name,
        barberId,
      });
      serviceId = meta.serviceId;
      commissionPct = meta.commissionPct;
    }

    items.push({
      itemType,
      name,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      productId: item.productId ? Number(item.productId) : null,
      serviceId,
      barberId,
      commissionPct,
    });
  }
  return items;
}

const createComanda = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    await ensureFinanceCategories(tenantId);
    const categoryId = await getSalesIncomeCategoryId(tenantId);

    const customerName = String(req.body.customerName || '').trim();
    if (!customerName) return res.status(400).json({ error: 'Informe o cliente' });

    const itemsInput = Array.isArray(req.body.items) ? req.body.items : [];
    const barberId = req.body.barberId ? Number(req.body.barberId) : null;

    const comanda = await prisma.$transaction(async (tx) => {
      const items = await mapItemsWithCommission(tx, tenantId, itemsInput, barberId);
      const total = items.reduce((s, i) => s + i.total, 0) || Number(req.body.total || 0);
      const number = await nextComandaNumber(tenantId, tx);
      return tx.comanda.create({
        data: {
          tenantId,
          number,
          customerName,
          customerId: req.body.customerId ? Number(req.body.customerId) : null,
          appointmentId: req.body.appointmentId ? Number(req.body.appointmentId) : null,
          origin: String(req.body.origin || 'MANUAL').toUpperCase(),
          status: 'OPEN',
          total,
          notes: req.body.notes ? String(req.body.notes) : null,
          barberId,
          categoryId,
          items: items.length ? { create: items } : undefined,
        },
        include: { items: true },
      });
    });

    res.status(201).json(comanda);
  } catch (error) {
    console.error(error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe comanda para este agendamento.' });
    }
    res.status(500).json({ error: 'Erro ao criar comanda' });
  }
};

const updateComandaItems = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.comanda.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: 'Comanda não encontrada' });
    if (existing.status !== 'OPEN') {
      return res.status(409).json({ error: 'Só é possível editar comandas abertas.' });
    }

    const itemsInput = Array.isArray(req.body.items) ? req.body.items : [];
    if (!itemsInput.length) {
      return res.status(400).json({ error: 'Informe ao menos um item.' });
    }

    const comanda = await prisma.$transaction(async (tx) => {
      const items = await mapItemsWithCommission(
        tx,
        tenantId,
        itemsInput,
        existing.barberId,
      );
      const total = items.reduce((s, i) => s + i.total, 0);
      await tx.comandaItem.deleteMany({ where: { comandaId: id } });
      return tx.comanda.update({
        where: { id },
        data: {
          total,
          customerName: req.body.customerName
            ? String(req.body.customerName).trim()
            : existing.customerName,
          barberId: req.body.barberId != null
            ? (req.body.barberId ? Number(req.body.barberId) : null)
            : existing.barberId,
          notes: req.body.notes != null ? String(req.body.notes) : existing.notes,
          items: { create: items },
        },
        include: { items: true },
      });
    });

    res.json(comanda);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar comanda' });
  }
};

const settleComanda = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const comanda = await prisma.comanda.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!comanda) return res.status(404).json({ error: 'Comanda não encontrada' });
    if (comanda.status === 'QUITADA') {
      return res.status(409).json({ error: 'Comanda já quitada' });
    }
    if (comanda.status === 'CANCELLED') {
      return res.status(409).json({ error: 'Comanda cancelada' });
    }

    const cashSessionId = req.body.cashSessionId ?? req.body.payments?.cashSessionId;
    let cashSession;
    try {
      cashSession = await resolveOpenCashSession(tenantId, cashSessionId);
    } catch (cashErr) {
      return res.status(cashErr.status || 409).json({
        error: cashErr.message,
        code: cashErr.code || 'CASH_CLOSED',
      });
    }

    const payments = req.body.payments || {};
    const splits = Array.isArray(payments.splits) ? payments.splits : [];
    const required = Number(comanda.total || 0);
    try {
      validatePaymentSplits(splits, required);
    } catch (payErr) {
      return res.status(payErr.status || 400).json({ error: payErr.message, code: payErr.code });
    }

    const result = await prisma.$transaction(async (tx) => {
      await applyProductStockFromItems(tx, {
        tenantId,
        items: comanda.items,
        barberId: comanda.barberId,
        customerId: comanda.customerId,
        customerName: comanda.customerName,
        saleDate: toLocalDateIso(new Date()),
      });

      const settled = await settleComandaInTx(tx, {
        tenantId,
        comandaId: comanda.id,
        cashSession,
        payments: {
          ...payments,
          splits,
          cashSessionId: cashSession.id,
          totalCheckout: required,
          paidAt: new Date().toISOString().slice(0, 10),
        },
        userId: req.user?.id,
        description: `Comanda Nº${String(comanda.number).padStart(4, '0')} — ${comanda.customerName}`,
      });

      if (comanda.appointmentId) {
        await tx.appointment.update({
          where: { id: comanda.appointmentId },
          data: {
            status: 'Finalizado',
            payments: {
              ...payments,
              splits,
              cashSessionId: cashSession.id,
              totalCheckout: required,
              paidAt: new Date().toISOString().slice(0, 10),
              comandaId: comanda.id,
            },
          },
        });
      }

      return settled;
    });

    res.json(result.comanda);
  } catch (error) {
    console.error(error);
    if (
      error?.code === 'STOCK_INSUFFICIENT'
      || error?.code === 'PRODUCT_NOT_FOUND'
      || error?.code === 'PAYMENT_MISMATCH'
    ) {
      return res.status(error.status || 400).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: 'Erro ao quitar comanda' });
  }
};

const reverseComanda = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ error: 'Apenas gestão pode estornar comandas.' });
    }
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.comanda.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: 'Comanda não encontrada' });

    const restoreStock = Boolean(req.body.restoreStock);
    const comanda = await prisma.$transaction(async (tx) =>
      reverseSettleComandaInTx(tx, {
        tenantId,
        comanda: existing,
        restoreStock,
        userId: req.user?.id,
      }),
    );
    res.json(comanda);
  } catch (error) {
    console.error(error);
    if (error?.code === 'NOT_QUITADA') {
      return res.status(409).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: 'Erro ao estornar comanda' });
  }
};

const cancelComanda = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ error: 'Apenas gestão pode cancelar comandas.' });
    }
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.comanda.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Comanda não encontrada' });
    if (existing.status === 'QUITADA') {
      return res.status(409).json({ error: 'Não é possível cancelar comanda já quitada. Use estorno.' });
    }
    const comanda = await prisma.comanda.update({
      where: { id },
      data: { status: 'CANCELLED', closedAt: new Date() },
      include: { items: true },
    });
    res.json(comanda);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar comanda' });
  }
};

const createDirectSale = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    await ensureFinanceCategories(tenantId);
    const categoryId = await getSalesIncomeCategoryId(tenantId);

    const customerName = String(req.body.customerName || 'Cliente balcão').trim();
    const itemsInput = Array.isArray(req.body.items) ? req.body.items : [];
    if (!itemsInput.length) {
      return res.status(400).json({ error: 'Informe os produtos da venda.' });
    }

    const cashSessionId = req.body.cashSessionId;
    let cashSession;
    try {
      cashSession = await resolveOpenCashSession(tenantId, cashSessionId);
    } catch (cashErr) {
      return res.status(cashErr.status || 409).json({
        error: cashErr.message,
        code: cashErr.code || 'CASH_CLOSED',
      });
    }

    const method = String(req.body.method || 'Pix');
    const barberId = req.body.barberId ? Number(req.body.barberId) : null;

    const result = await prisma.$transaction(async (tx) => {
      const items = await mapItemsWithCommission(tx, tenantId, itemsInput.map((i) => ({
        ...i,
        itemType: 'PRODUCT',
      })), barberId);
      const total = items.reduce((s, i) => s + i.total, 0);
      if (!(total > 0)) {
        const err = new Error('Valor da venda inválido.');
        err.status = 400;
        throw err;
      }

      const number = await nextComandaNumber(tenantId, tx);
      const comanda = await tx.comanda.create({
        data: {
          tenantId,
          number,
          customerName,
          customerId: req.body.customerId ? Number(req.body.customerId) : null,
          origin: 'MANUAL',
          status: 'OPEN',
          total,
          barberId,
          categoryId,
          items: { create: items },
        },
        include: { items: true },
      });

      await applyProductStockFromItems(tx, {
        tenantId,
        items,
        barberId,
        customerId: comanda.customerId,
        customerName,
        saleDate: toLocalDateIso(new Date()),
      });

      return settleComandaInTx(tx, {
        tenantId,
        comandaId: comanda.id,
        cashSession,
        payments: {
          splits: [{ method, amount: total }],
          cashSessionId: cashSession.id,
          totalCheckout: total,
          paidAt: toLocalDateIso(new Date()),
        },
        userId: req.user?.id,
        description: `Venda avulsa Nº${String(comanda.number).padStart(4, '0')} — ${customerName}`,
      });
    });

    res.status(201).json(result.comanda);
  } catch (error) {
    console.error(error);
    if (
      error?.code === 'STOCK_INSUFFICIENT'
      || error?.code === 'PRODUCT_NOT_FOUND'
      || error?.code === 'CASH_CLOSED'
      || error?.code === 'CASH_REQUIRED'
    ) {
      return res.status(error.status || 409).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: error.message || 'Erro na venda avulsa' });
  }
};

module.exports = {
  listComandas,
  getComanda,
  createComanda,
  createDirectSale,
  updateComandaItems,
  settleComanda,
  reverseComanda,
  cancelComanda,
};
