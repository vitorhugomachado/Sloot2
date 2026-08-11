const prisma = require('../lib/prisma.js');
const { HEAVY_TX } = require('../lib/prisma.js');
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
  assertCatalogProductItems,
  computePayableTotal,
  resolveStaffName,
  writeAuditLog,
  assertPeriodNotClosed,
  sumComandaPaidAmount,
  enrichCardSplits,
  allocateCardFeesToBarbers,
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

    const [productSales, firstMovement] = await Promise.all([
      prisma.productSale.findMany({
        where: { tenantId, comandaId: id },
        orderBy: { id: 'asc' },
      }),
      prisma.cashMovement.findFirst({
        where: {
          tenantId,
          referenceType: 'Comanda',
          referenceId: id,
          source: 'COMANDA',
        },
        orderBy: { createdAt: 'asc' },
        select: { createdById: true },
      }),
    ]);

    const paidAmount = await sumComandaPaidAmount(prisma, tenantId, id);
    const payments = (typeof comanda.payments === 'object' && comanda.payments) ? comanda.payments : {};
    const settledById = firstMovement?.createdById || null;
    const settledByName = settledById ? await resolveStaffName(settledById) : null;

    const timeline = [];
    if (comanda.openedAt) {
      timeline.push({ at: comanda.openedAt, label: 'Aberta' });
    }
    if (comanda.closedAt) {
      timeline.push({ at: comanda.closedAt, label: 'Quitada' });
    }
    if (payments.reversedAt) {
      timeline.push({ at: payments.reversedAt, label: 'Estornada' });
    }

    const st = String(comanda.status || '').toUpperCase();
    const balanceDue = st === 'PARTIAL'
      ? Math.max(0, Math.round((Number(comanda.total || 0) - paidAmount) * 100) / 100)
      : 0;

    res.json({
      ...comanda,
      productSales,
      settlementMeta: {
        paidAt: payments.paidAt || null,
        discountAmount: Number(payments.discountAmount ?? payments.discount ?? 0),
        tipAmount: Number(payments.tipAmount ?? payments.tip ?? 0),
        totalCheckout: Number(payments.totalCheckout ?? comanda.total ?? 0),
        settledById,
        settledByName,
        timeline,
        paidAmount,
        balanceDue,
      },
    });
  } catch (error) {
    console.error(error);
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
    let productId = item.productId ? Number(item.productId) : null;

    if (itemType === 'SERVICE') {
      const meta = await resolveServiceCommissionMeta(tx, {
        tenantId,
        serviceId,
        serviceName: name,
        barberId,
      });
      serviceId = meta.serviceId;
      commissionPct = meta.commissionPct;
      productId = null;
    }

    if (itemType === 'PRODUCT' && productId) {
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true, name: true, price: true },
      });
      if (!product) {
        const err = new Error(`Produto #${productId} não encontrado.`);
        err.code = 'PRODUCT_NOT_FOUND';
        err.status = 400;
        throw err;
      }
    }

    items.push({
      itemType,
      name,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      productId: itemType === 'PRODUCT' ? productId : null,
      serviceId: itemType === 'SERVICE' ? serviceId : null,
      barberId,
      commissionPct: itemType === 'SERVICE' ? commissionPct : null,
    });
  }
  assertCatalogProductItems(items);
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
    if (
      error?.code === 'PRODUCT_REQUIRED'
      || error?.code === 'PRODUCT_NOT_FOUND'
    ) {
      return res.status(error.status || 400).json({ error: error.message, code: error.code });
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
    if (existing.status !== 'OPEN' && existing.status !== 'PARTIAL') {
      return res.status(409).json({ error: 'Só é possível editar comandas abertas ou parciais.' });
    }
    if (existing.status === 'PARTIAL') {
      return res.status(409).json({
        error: 'Comanda com pagamento parcial: não é possível alterar itens. Quite o saldo restante.',
        code: 'PARTIAL_LOCKED',
      });
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
    if (
      error?.code === 'PRODUCT_REQUIRED'
      || error?.code === 'PRODUCT_NOT_FOUND'
    ) {
      return res.status(error.status || 400).json({ error: error.message, code: error.code });
    }
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
    const allowPartial = Boolean(req.body.allowPartial || payments.allowPartial);
    const alreadyPartial = String(comanda.status).toUpperCase() === 'PARTIAL';

    let payableMeta;
    try {
      const itemsTotal = alreadyPartial
        ? Number(comanda.payments?.itemsTotal ?? comanda.total)
        : Number(comanda.total || 0);

      payableMeta = alreadyPartial
        ? {
            itemsTotal,
            discount: Number(comanda.payments?.discountAmount || 0),
            tip: Number(comanda.payments?.tipAmount || 0),
            payable: Number(comanda.payments?.totalCheckout ?? comanda.total),
          }
        : computePayableTotal(itemsTotal, {
            ...payments,
            discountAmount: req.body.discountAmount ?? payments.discountAmount,
            tipAmount: req.body.tipAmount ?? payments.tipAmount,
          });

      const splitSum = splits.reduce((s, p) => s + Number(p.amount || 0), 0);
      if (!(splitSum > 0)) {
        return res.status(400).json({ error: 'Informe ao menos um pagamento com valor.' });
      }

      if (!allowPartial && !alreadyPartial) {
        validatePaymentSplits(splits, payableMeta.payable);
      } else if (!alreadyPartial && allowPartial && splitSum > payableMeta.payable + 0.01) {
        return res.status(400).json({
          error: `Pagamento (R$ ${splitSum.toFixed(2)}) excede o total (R$ ${payableMeta.payable.toFixed(2)}).`,
          code: 'PAYMENT_OVER',
        });
      } else if (alreadyPartial) {
        const alreadyPaid = await sumComandaPaidAmount(prisma, tenantId, comanda.id);
        const remaining = Math.round((payableMeta.payable - alreadyPaid) * 100) / 100;
        if (splitSum > remaining + 0.01) {
          return res.status(400).json({
            error: `Pagamento (R$ ${splitSum.toFixed(2)}) excede o saldo (R$ ${remaining.toFixed(2)}).`,
            code: 'PAYMENT_OVER',
          });
        }
      }

      assertCatalogProductItems(comanda.items);
    } catch (payErr) {
      return res.status(payErr.status || 400).json({ error: payErr.message, code: payErr.code });
    }

    const today = toLocalDateIso(new Date());
    try {
      await assertPeriodNotClosed(tenantId, today);
    } catch (periodErr) {
      return res.status(periodErr.status || 409).json({
        error: periodErr.message,
        code: periodErr.code,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const alreadyPaid = await sumComandaPaidAmount(tx, tenantId, comanda.id);
      const splitSum = splits.reduce((s, p) => s + Number(p.amount || 0), 0);
      const newPaidTotal = Math.round((alreadyPaid + splitSum) * 100) / 100;
      const isFull = newPaidTotal >= payableMeta.payable - 0.01;
      const willBePartial = !isFull && (allowPartial || alreadyPartial);

      if (!isFull && !allowPartial && !alreadyPartial) {
        const err = new Error(
          `Total pago (R$ ${splitSum.toFixed(2)}) deve igualar o total (R$ ${payableMeta.payable.toFixed(2)}).`,
        );
        err.code = 'PAYMENT_MISMATCH';
        err.status = 400;
        throw err;
      }

      const stockAlreadyApplied = Boolean(
        alreadyPartial
        && (await tx.productSale.count({ where: { tenantId, comandaId: comanda.id } })) > 0,
      );
      if (isFull && !stockAlreadyApplied) {
        await applyProductStockFromItems(tx, {
          tenantId,
          items: comanda.items,
          barberId: comanda.barberId,
          customerId: comanda.customerId,
          customerName: comanda.customerName,
          saleDate: today,
          comandaId: comanda.id,
        });
      }

      const prevPayments = (typeof comanda.payments === 'object' && comanda.payments)
        ? comanda.payments
        : {};
      const prevSplits = Array.isArray(prevPayments.splits) ? prevPayments.splits : [];

      const enrichedNewSplits = await enrichCardSplits(tx, tenantId, splits);
      const allSplits = [...prevSplits, ...enrichedNewSplits];
      const feeMeta = allocateCardFeesToBarbers(allSplits, comanda.items, comanda.barberId);

      const paymentPayload = {
        ...prevPayments,
        ...payments,
        splits: allSplits,
        cashSessionId: cashSession.id,
        itemsTotal: payableMeta.itemsTotal,
        discountAmount: payableMeta.discount,
        tipAmount: payableMeta.tip,
        totalCheckout: payableMeta.payable,
        paidAmount: newPaidTotal,
        paidAt: today,
        allowPartial: willBePartial || undefined,
        cardFeeTotal: feeMeta.cardFeeTotal,
        cardFeeByBarber: feeMeta.cardFeeByBarber,
      };

      const settled = await settleComandaInTx(tx, {
        tenantId,
        comandaId: comanda.id,
        cashSession,
        payments: paymentPayload,
        splitsToRecord: enrichedNewSplits,
        userId: req.user?.id,
        description: `Comanda Nº${String(comanda.number).padStart(4, '0')} — ${comanda.customerName}`,
        totalOverride: payableMeta.payable,
        status: isFull ? 'QUITADA' : 'PARTIAL',
      });

      if (isFull && comanda.appointmentId) {
        await tx.appointment.update({
          where: { id: comanda.appointmentId },
          data: {
            status: 'Finalizado',
            payments: {
              ...paymentPayload,
              comandaId: comanda.id,
            },
          },
        });
      }

      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: isFull ? 'SETTLE_COMANDA' : 'PARTIAL_SETTLE_COMANDA',
        entity: 'Comanda',
        entityId: comanda.id,
        payload: {
          paidAmount: newPaidTotal,
          totalCheckout: payableMeta.payable,
          splits,
          cashSessionId: cashSession.id,
        },
      });

      return settled;
    }, HEAVY_TX);

    res.json(result.comanda);
  } catch (error) {
    console.error(error);
    if (
      error?.code === 'STOCK_INSUFFICIENT'
      || error?.code === 'PRODUCT_NOT_FOUND'
      || error?.code === 'PRODUCT_REQUIRED'
      || error?.code === 'PAYMENT_MISMATCH'
      || error?.code === 'DISCOUNT_INVALID'
      || error?.code === 'PERIOD_CLOSED'
      || error?.code === 'CARD_BRAND_REQUIRED'
      || error?.code === 'CARD_KIND_REQUIRED'
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

    const restoreStock = req.body.restoreStock !== false;
    const comanda = await prisma.$transaction(async (tx) => {
      const reopened = await reverseSettleComandaInTx(tx, {
        tenantId,
        comanda: existing,
        restoreStock,
        userId: req.user?.id,
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'REVERSE_COMANDA',
        entity: 'Comanda',
        entityId: existing.id,
        payload: { restoreStock, previousStatus: existing.status },
      });
      return reopened;
    });
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
    if (existing.status === 'PARTIAL') {
      return res.status(409).json({
        error: 'Comanda com pagamento parcial: estorne os pagamentos antes de cancelar.',
        code: 'PARTIAL_CANCEL',
      });
    }
    const comanda = await prisma.$transaction(async (tx) => {
      const updated = await tx.comanda.update({
        where: { id },
        data: { status: 'CANCELLED', closedAt: new Date() },
        include: { items: true },
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'CANCEL_COMANDA',
        entity: 'Comanda',
        entityId: id,
        payload: { number: existing.number },
      });
      return updated;
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
    const today = toLocalDateIso(new Date());
    try {
      await assertPeriodNotClosed(tenantId, today);
    } catch (periodErr) {
      return res.status(periodErr.status || 409).json({
        error: periodErr.message,
        code: periodErr.code,
      });
    }

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
        saleDate: today,
        comandaId: comanda.id,
      });

      const paymentSplits = await enrichCardSplits(tx, tenantId, [{
        method,
        amount: total,
        cardBrand: req.body.cardBrand,
        cardKind: req.body.cardKind,
      }]);
      const feeMeta = allocateCardFeesToBarbers(paymentSplits, items, barberId);

      const settled = await settleComandaInTx(tx, {
        tenantId,
        comandaId: comanda.id,
        cashSession,
        payments: {
          splits: paymentSplits,
          cashSessionId: cashSession.id,
          itemsTotal: total,
          discountAmount: 0,
          tipAmount: 0,
          totalCheckout: total,
          paidAmount: total,
          paidAt: today,
          cardFeeTotal: feeMeta.cardFeeTotal,
          cardFeeByBarber: feeMeta.cardFeeByBarber,
        },
        userId: req.user?.id,
        description: `Venda avulsa Nº${String(comanda.number).padStart(4, '0')} — ${customerName}`,
        totalOverride: total,
      });

      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'DIRECT_SALE',
        entity: 'Comanda',
        entityId: comanda.id,
        payload: { total, method },
      });

      return settled;
    }, HEAVY_TX);

    res.status(201).json(result.comanda);
  } catch (error) {
    console.error(error);
    if (
      error?.code === 'STOCK_INSUFFICIENT'
      || error?.code === 'PRODUCT_NOT_FOUND'
      || error?.code === 'PRODUCT_REQUIRED'
      || error?.code === 'CASH_CLOSED'
      || error?.code === 'CASH_REQUIRED'
      || error?.code === 'PERIOD_CLOSED'
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
