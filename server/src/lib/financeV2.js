const prisma = require('../lib/prisma.js');

const DEFAULT_CATEGORIES = [
  { name: 'Receitas de Vendas', kind: 'INCOME', slug: 'receitas-de-vendas' },
  { name: 'Outras Receitas', kind: 'INCOME', slug: 'outras-receitas' },
  { name: 'custo fixo', kind: 'EXPENSE', slug: 'custo-fixo' },
  { name: 'Custo Variavel', kind: 'EXPENSE', slug: 'custo-variavel' },
  { name: 'Despesas de Marketing', kind: 'EXPENSE', slug: 'despesas-marketing' },
  { name: 'Despesas Diretas', kind: 'EXPENSE', slug: 'despesas-diretas' },
  { name: 'Despesas Financeiras', kind: 'EXPENSE', slug: 'despesas-financeiras' },
  { name: 'Despesas Fixas', kind: 'EXPENSE', slug: 'despesas-fixas' },
  { name: 'Despesas Indiretas', kind: 'EXPENSE', slug: 'despesas-indiretas' },
  { name: 'Impostos', kind: 'EXPENSE', slug: 'impostos' },
  { name: 'Investimentos', kind: 'EXPENSE', slug: 'investimentos' },
];

const DEFAULT_BARBER_COMMISSION_PCT = 50;

async function ensureFinanceCategories(tenantId, tx = prisma) {
  const existing = await tx.financeCategory.findMany({ where: { tenantId } });
  if (existing.length > 0) return existing;

  await tx.financeCategory.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, tenantId })),
    skipDuplicates: true,
  });
  return tx.financeCategory.findMany({ where: { tenantId } });
}

async function getSalesIncomeCategoryId(tenantId, tx = prisma) {
  await ensureFinanceCategories(tenantId, tx);
  const cat = await tx.financeCategory.findFirst({
    where: { tenantId, kind: 'INCOME', slug: 'receitas-de-vendas' },
  });
  return cat?.id || null;
}

async function getOpenCashSession(tenantId, tx = prisma) {
  return tx.cashSession.findFirst({
    where: { tenantId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
}

async function resolveStaffName(userId, tx = prisma) {
  if (!userId) return null;
  const barber = await tx.barber.findUnique({
    where: { id: Number(userId) },
    select: { name: true },
  });
  return barber?.name || null;
}

function summarizeSessionMovements(movements, openingFloat = 0) {
  const byMethod = {};
  let totalIn = 0;
  let totalOut = 0;
  for (const m of movements) {
    const amount = Number(m.amount || 0);
    if (m.type === 'IN') totalIn += amount;
    else totalOut += amount;
    const method = m.method || 'Outro';
    if (!byMethod[method]) byMethod[method] = { in: 0, out: 0 };
    if (m.type === 'IN') byMethod[method].in += amount;
    else byMethod[method].out += amount;
  }
  const cashIn = byMethod.Dinheiro?.in || 0;
  const cashOut = byMethod.Dinheiro?.out || 0;
  const expectedCash = Number(openingFloat || 0) + cashIn - cashOut;
  return {
    totalIn,
    totalOut,
    balance: totalIn - totalOut,
    byMethod,
    expectedCash,
  };
}

async function nextComandaNumber(tenantId, tx = prisma) {
  const last = await tx.comanda.findFirst({
    where: { tenantId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number || 0) + 1;
}

/**
 * % que o profissional recebe (0–100). Preferência: Service.commissionPct.
 * Fallback: 100 - Barber.commission (legado = % da casa), senão 50.
 */
function clampPct(n, fallback = DEFAULT_BARBER_COMMISSION_PCT) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}

async function resolveServiceCommissionPct(tx, {
  tenantId,
  serviceId,
  serviceName,
  barberId,
}) {
  if (serviceId) {
    const svc = await tx.service.findFirst({
      where: { id: Number(serviceId), tenantId },
      select: { commissionPct: true },
    });
    if (svc && svc.commissionPct != null) return clampPct(svc.commissionPct);
  }
  if (serviceName) {
    const svc = await tx.service.findFirst({
      where: { tenantId, name: String(serviceName) },
      select: { commissionPct: true, id: true },
    });
    if (svc && svc.commissionPct != null) {
      return { pct: clampPct(svc.commissionPct), serviceId: svc.id };
    }
  }
  if (barberId) {
    const barber = await tx.barber.findFirst({
      where: { id: Number(barberId), tenantId },
      select: { commission: true },
    });
    // Barber.commission legado = % da casa → profissional recebe o restante
    if (barber && barber.commission != null) {
      return clampPct(100 - Number(barber.commission));
    }
  }
  return DEFAULT_BARBER_COMMISSION_PCT;
}

async function resolveServiceCommissionMeta(tx, {
  tenantId,
  serviceId,
  serviceName,
  barberId,
}) {
  let resolvedServiceId = serviceId ? Number(serviceId) : null;
  let pct = null;

  if (resolvedServiceId) {
    const svc = await tx.service.findFirst({
      where: { id: resolvedServiceId, tenantId },
      select: { commissionPct: true, id: true },
    });
    if (svc) {
      pct = svc.commissionPct != null ? clampPct(svc.commissionPct) : null;
      resolvedServiceId = svc.id;
    }
  }

  if (pct == null && serviceName) {
    const svc = await tx.service.findFirst({
      where: { tenantId, name: String(serviceName) },
      select: { commissionPct: true, id: true },
    });
    if (svc) {
      pct = svc.commissionPct != null ? clampPct(svc.commissionPct) : null;
      resolvedServiceId = svc.id;
    }
  }

  if (pct == null && barberId) {
    const barber = await tx.barber.findFirst({
      where: { id: Number(barberId), tenantId },
      select: { commission: true },
    });
    if (barber && barber.commission != null) {
      pct = clampPct(100 - Number(barber.commission));
    }
  }

  return {
    serviceId: resolvedServiceId,
    commissionPct: pct != null ? pct : DEFAULT_BARBER_COMMISSION_PCT,
  };
}

function validatePaymentSplits(splits, requiredTotal) {
  const list = Array.isArray(splits) ? splits : [];
  const totalPaid = list.reduce((s, p) => s + Number(p.amount || 0), 0);
  const required = Number(requiredTotal || 0);
  if (required > 0 && Math.abs(totalPaid - required) > 0.01) {
    const err = new Error(
      `Total pago (R$ ${totalPaid.toFixed(2)}) deve igualar o total (R$ ${required.toFixed(2)}).`,
    );
    err.code = 'PAYMENT_MISMATCH';
    err.status = 400;
    throw err;
  }
  return totalPaid;
}

/**
 * Garante comanda OPEN ligada ao agendamento (cria se não existir).
 */
async function ensureOpenComandaForAppointment(tx, {
  tenantId,
  appointment,
  categoryId,
}) {
  const existing = await tx.comanda.findFirst({
    where: { tenantId, appointmentId: appointment.id },
    include: { items: true },
  });
  if (existing) {
    if (existing.status === 'CANCELLED') {
      return tx.comanda.update({
        where: { id: existing.id },
        data: {
          status: 'OPEN',
          closedAt: null,
          customerName: appointment.customer,
          customerId: appointment.customer_id || null,
          barberId: appointment.barberId || null,
          total: Number(appointment.price || existing.total || 0),
          categoryId: existing.categoryId || categoryId,
        },
        include: { items: true },
      });
    }
    return existing;
  }

  const number = await nextComandaNumber(tenantId, tx);
  const unitPrice = Number(appointment.price || 0);
  const meta = await resolveServiceCommissionMeta(tx, {
    tenantId,
    serviceName: appointment.service,
    barberId: appointment.barberId,
  });

  return tx.comanda.create({
    data: {
      tenantId,
      number,
      customerName: appointment.customer,
      customerId: appointment.customer_id || null,
      appointmentId: appointment.id,
      origin: 'AGENDA',
      status: 'OPEN',
      total: unitPrice,
      barberId: appointment.barberId || null,
      categoryId,
      items: {
        create: [
          {
            itemType: 'SERVICE',
            name: String(appointment.service || 'Serviço'),
            quantity: 1,
            unitPrice,
            total: unitPrice,
            barberId: appointment.barberId || null,
            serviceId: meta.serviceId,
            commissionPct: meta.commissionPct,
          },
        ],
      },
    },
    include: { items: true },
  });
}

async function cancelOpenComandaForAppointment(tx, { tenantId, appointmentId }) {
  const comanda = await tx.comanda.findFirst({
    where: { tenantId, appointmentId: Number(appointmentId) },
  });
  if (!comanda) return null;
  if (comanda.status === 'QUITADA') return comanda;
  if (comanda.status === 'CANCELLED') return comanda;
  return tx.comanda.update({
    where: { id: comanda.id },
    data: { status: 'CANCELLED', closedAt: new Date() },
  });
}

async function resolveOpenCashSession(tenantId, cashSessionId, tx = prisma) {
  const id = Number(cashSessionId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error('Selecione o caixa do dia para confirmar o recebimento.');
    err.code = 'CASH_REQUIRED';
    err.status = 400;
    throw err;
  }
  const session = await tx.cashSession.findFirst({
    where: { id, tenantId, status: 'OPEN' },
  });
  if (!session) {
    const err = new Error('Caixa inválido ou fechado. Selecione um caixa aberto.');
    err.code = 'CASH_CLOSED';
    err.status = 409;
    throw err;
  }
  return session;
}

/**
 * Baixa estoque + ProductSale para itens PRODUCT da comanda (dentro da tx de settle).
 */
async function applyProductStockFromItems(tx, {
  tenantId,
  items,
  barberId,
  customerId,
  customerName,
  saleDate,
}) {
  const productItems = (items || []).filter(
    (i) => String(i.itemType || '').toUpperCase() === 'PRODUCT' && i.productId,
  );
  const sales = [];
  for (const item of productItems) {
    const productId = Number(item.productId);
    const qty = Math.max(1, Number(item.quantity || 1));
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      const err = new Error(`Produto #${productId} não encontrado.`);
      err.code = 'PRODUCT_NOT_FOUND';
      err.status = 400;
      throw err;
    }
    if (Number(product.stock || 0) < qty) {
      const err = new Error(
        `Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`,
      );
      err.code = 'STOCK_INSUFFICIENT';
      err.status = 400;
      throw err;
    }
    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: qty } },
    });
    const sale = await tx.productSale.create({
      data: {
        tenantId,
        productId,
        productName: product.name,
        price: Number(item.unitPrice != null ? item.unitPrice : product.price || 0),
        cost: Number(product.cost || 0),
        quantity: qty,
        date: saleDate || toLocalDateIso(new Date()),
        barberId: barberId || null,
        customerId: customerId || null,
        customerName: customerName || null,
      },
    });
    sales.push(sale);
  }
  return sales;
}

/**
 * Quitação de comanda: grava movimentos por split, fecha (QUITADA).
 */
async function settleComandaInTx(tx, {
  tenantId,
  comandaId,
  cashSession,
  payments,
  userId,
  description,
}) {
  const splits = Array.isArray(payments?.splits) && payments.splits.length > 0
    ? payments.splits
    : [{ method: 'Outro', amount: Number(payments?.totalCheckout || payments?.amount || 0) }];

  const movements = [];
  for (const split of splits) {
    const amount = Number(split.amount || 0);
    if (amount <= 0) continue;
    const mov = await tx.cashMovement.create({
      data: {
        tenantId,
        cashSessionId: cashSession.id,
        type: 'IN',
        source: 'COMANDA',
        amount,
        method: String(split.method || 'Outro'),
        description: description || `Comanda #${comandaId}`,
        referenceType: 'Comanda',
        referenceId: comandaId,
        createdById: userId || null,
      },
    });
    movements.push(mov);
  }

  const closedAt = new Date();
  const comanda = await tx.comanda.update({
    where: { id: comandaId },
    data: {
      status: 'QUITADA',
      closedAt,
      cashSessionId: cashSession.id,
      payments: payments || undefined,
    },
    include: { items: true },
  });

  return { comanda, movements };
}

/**
 * Estorno: remove movimentos COMANDA, reabre comanda, opcionalmente restaura estoque.
 */
async function reverseSettleComandaInTx(tx, {
  tenantId,
  comanda,
  restoreStock = false,
  userId,
}) {
  if (comanda.status !== 'QUITADA') {
    const err = new Error('Só é possível estornar comanda quitada.');
    err.code = 'NOT_QUITADA';
    err.status = 409;
    throw err;
  }

  await tx.cashMovement.deleteMany({
    where: {
      tenantId,
      referenceType: 'Comanda',
      referenceId: comanda.id,
      source: 'COMANDA',
    },
  });

  if (restoreStock) {
    const items = comanda.items || await tx.comandaItem.findMany({ where: { comandaId: comanda.id } });
    for (const item of items) {
      if (String(item.itemType).toUpperCase() !== 'PRODUCT' || !item.productId) continue;
      await tx.product.update({
        where: { id: Number(item.productId) },
        data: { stock: { increment: Math.max(1, Number(item.quantity || 1)) } },
      });
    }
  }

  const reopened = await tx.comanda.update({
    where: { id: comanda.id },
    data: {
      status: 'OPEN',
      closedAt: null,
      cashSessionId: null,
      payments: {
        ...(typeof comanda.payments === 'object' && comanda.payments ? comanda.payments : {}),
        reversedAt: new Date().toISOString(),
        reversedById: userId || null,
      },
    },
    include: { items: true },
  });

  if (comanda.appointmentId) {
    await tx.appointment.update({
      where: { id: comanda.appointmentId },
      data: {
        status: 'Em progresso',
        payments: null,
      },
    });
  }

  return reopened;
}

function toLocalDateIso(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

function brazilDayBounds(start, end) {
  const bounds = {};
  if (start) bounds.gte = new Date(`${start}T00:00:00.000-03:00`);
  if (end) bounds.lte = new Date(`${end}T23:59:59.999-03:00`);
  return Object.keys(bounds).length ? bounds : undefined;
}

function comandaSettlementDate(comanda) {
  const paidAt = String(comanda?.payments?.paidAt || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) return paidAt;
  return toLocalDateIso(comanda?.closedAt);
}

function splitItemCommission(itemTotal, commissionPct) {
  const gross = Number(itemTotal || 0);
  const pct = clampPct(commissionPct);
  const barber = gross * (pct / 100);
  const house = gross - barber;
  return { barber, house, pct };
}

module.exports = {
  DEFAULT_CATEGORIES,
  DEFAULT_BARBER_COMMISSION_PCT,
  ensureFinanceCategories,
  getSalesIncomeCategoryId,
  getOpenCashSession,
  resolveStaffName,
  summarizeSessionMovements,
  nextComandaNumber,
  ensureOpenComandaForAppointment,
  cancelOpenComandaForAppointment,
  resolveOpenCashSession,
  settleComandaInTx,
  reverseSettleComandaInTx,
  applyProductStockFromItems,
  validatePaymentSplits,
  resolveServiceCommissionMeta,
  resolveServiceCommissionPct,
  clampPct,
  splitItemCommission,
  toLocalDateIso,
  brazilDayBounds,
  comandaSettlementDate,
};
