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

/**
 * Lança entrada no razão financeiro (LedgerEntry).
 * amount sempre positivo; direção via direction IN|OUT.
 */
async function writeLedgerEntry(tx, {
  tenantId,
  kind,
  amount,
  direction,
  method,
  account = 'CAIXA',
  referenceType,
  referenceId,
  description,
  createdById,
  occurredAt,
}) {
  const amt = Math.abs(Number(amount || 0));
  if (!(amt > 0)) return null;
  const dir = String(direction || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN';
  return tx.ledgerEntry.create({
    data: {
      tenantId: Number(tenantId),
      kind: String(kind || 'INCOME').toUpperCase(),
      amount: amt,
      direction: dir,
      method: method ? String(method) : null,
      account: String(account || 'CAIXA').toUpperCase(),
      referenceType: referenceType || null,
      referenceId: referenceId != null ? Number(referenceId) : null,
      description: String(description || ''),
      createdById: createdById != null ? Number(createdById) : null,
      ...(occurredAt ? { occurredAt } : {}),
    },
  });
}

/**
 * Auditoria financeira (FinanceAuditLog).
 */
async function writeAuditLog(tx, {
  tenantId,
  userId,
  userName,
  action,
  entity,
  entityId,
  payload,
}) {
  let name = userName || null;
  if (!name && userId) {
    name = await resolveStaffName(userId, tx);
  }
  return tx.financeAuditLog.create({
    data: {
      tenantId: Number(tenantId),
      userId: userId != null ? Number(userId) : null,
      userName: name,
      action: String(action || ''),
      entity: String(entity || ''),
      entityId: entityId != null ? Number(entityId) : null,
      payload: payload != null ? payload : undefined,
    },
  });
}

/**
 * Bloqueia lançamentos em datas cobertas por FinanceClosing.
 * @throws {Error} code PERIOD_CLOSED status 409
 */
async function assertPeriodNotClosed(tenantId, date, tx = prisma) {
  const d = String(date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
  const closed = await tx.financeClosing.findFirst({
    where: {
      tenantId: Number(tenantId),
      periodStart: { lte: d },
      periodEnd: { gte: d },
    },
  });
  if (closed) {
    const err = new Error(
      `Período ${closed.periodStart} a ${closed.periodEnd} está fechado. Reabra o fechamento para lançar.`,
    );
    err.code = 'PERIOD_CLOSED';
    err.status = 409;
    err.closing = closed;
    throw err;
  }
}

/**
 * Soma pagos já lançados (movimentos COMANDA) para uma comanda.
 */
async function sumComandaPaidAmount(tx, tenantId, comandaId) {
  const ag = await tx.comandaPayment.aggregate({
    where: {
      tenantId: Number(tenantId),
      comandaId: Number(comandaId),
    },
    _sum: { amount: true },
  });
  return Number(ag._sum.amount || 0);
}

function summarizeSessionMovements(movements, openingFloat = 0) {
  const byMethod = {};
  let totalIn = 0;
  let totalOut = 0;
  let openingInCash = 0;
  for (const m of movements) {
    const amount = Number(m.amount || 0);
    if (m.type === 'IN') totalIn += amount;
    else totalOut += amount;
    const method = m.method || 'Outro';
    if (!byMethod[method]) byMethod[method] = { in: 0, out: 0 };
    if (m.type === 'IN') byMethod[method].in += amount;
    else byMethod[method].out += amount;
    // Troco inicial também vira movimento OPENING — não somar 2× no esperado
    if (
      m.type === 'IN'
      && String(m.source || '') === 'OPENING'
      && String(method) === 'Dinheiro'
    ) {
      openingInCash += amount;
    }
  }
  const cashIn = byMethod.Dinheiro?.in || 0;
  const cashOut = byMethod.Dinheiro?.out || 0;
  const float = Number(openingFloat || 0);
  // Preferir openingFloat da sessão; excluir OPENING já espelhado nos movimentos
  const cashInExOpening = cashIn - openingInCash;
  const expectedCash = float + cashInExOpening - cashOut;
  return {
    totalIn,
    totalOut,
    balance: totalIn - totalOut,
    byMethod,
    expectedCash,
    cashIn: cashInExOpening,
    cashOut,
    openingFloat: float,
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

/** Itens PRODUCT do V2 precisam de productId do catálogo (estoque). */
function assertCatalogProductItems(items) {
  for (const item of items || []) {
    if (String(item.itemType || '').toUpperCase() !== 'PRODUCT') continue;
    const productId = Number(item.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      const err = new Error(
        `Produto "${item.name || 'sem nome'}" precisa ser escolhido do catálogo.`,
      );
      err.code = 'PRODUCT_REQUIRED';
      err.status = 400;
      throw err;
    }
  }
}

/**
 * Total a cobrar = soma itens − desconto + gorjeta.
 */
function computePayableTotal(itemsTotal, payments = {}) {
  const base = Number(itemsTotal || 0);
  const discount = Math.max(0, Number(payments.discountAmount ?? payments.discount ?? 0));
  const tip = Math.max(0, Number(payments.tipAmount ?? payments.tip ?? 0));
  const payable = Math.round((base - discount + tip) * 100) / 100;
  if (payable < 0) {
    const err = new Error('Desconto não pode exceder o total dos itens.');
    err.code = 'DISCOUNT_INVALID';
    err.status = 400;
    throw err;
  }
  return { itemsTotal: base, discount, tip, payable };
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
  comandaId,
}) {
  assertCatalogProductItems(items);
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
        comandaId: comandaId ? Number(comandaId) : null,
      },
    });
    sales.push(sale);
  }
  return sales;
}

/**
 * Quitação de comanda: grava movimentos por split, fecha (QUITADA) ou PARTIAL.
 * @param {string} [status='QUITADA'] — QUITADA | PARTIAL
 * @param {boolean} [writeLedger=true] — lança LedgerEntry INCOME IN por split
 */
async function settleComandaInTx(tx, {
  tenantId,
  comandaId,
  cashSession,
  payments,
  userId,
  description,
  totalOverride,
  status = 'QUITADA',
  writeLedger = true,
  /** Apenas estes splits geram CashMovement/Ledger (pagamentos novos). Se omitido, usa payments.splits. */
  splitsToRecord,
}) {
  const splits = Array.isArray(splitsToRecord) && splitsToRecord.length > 0
    ? splitsToRecord
    : (Array.isArray(payments?.splits) && payments.splits.length > 0
      ? payments.splits
      : [{ method: 'Outro', amount: Number(payments?.totalCheckout || payments?.amount || 0) }]);

  const finalStatus = String(status || 'QUITADA').toUpperCase() === 'PARTIAL' ? 'PARTIAL' : 'QUITADA';
  const desc = description || `Comanda #${comandaId}`;

  const movements = [];
  for (const split of splits) {
    const amount = Number(split.amount || 0);
    if (amount <= 0) continue;
    const method = String(split.method || 'Outro');
    const mov = await tx.cashMovement.create({
      data: {
        tenantId,
        cashSessionId: cashSession.id,
        type: 'IN',
        source: 'COMANDA',
        amount,
        method,
        description: desc,
        referenceType: 'Comanda',
        referenceId: comandaId,
        createdById: userId || null,
      },
    });
    movements.push(mov);

    await tx.comandaPayment.create({
      data: {
        tenantId,
        comandaId,
        cashSessionId: cashSession.id,
        amount,
        method,
        cardBrand: split.cardBrand ? String(split.cardBrand) : null,
        cardKind: split.cardKind ? String(split.cardKind) : null,
        cardFee: split.cardFee != null ? Number(split.cardFee) : null,
        createdById: userId || null,
      },
    });

    if (writeLedger) {
      await writeLedgerEntry(tx, {
        tenantId,
        kind: 'INCOME',
        amount,
        direction: 'IN',
        method,
        account: 'CAIXA',
        referenceType: 'Comanda',
        referenceId: comandaId,
        description: desc,
        createdById: userId || null,
      });
    }
  }

  const updateData = {
    status: finalStatus,
    cashSessionId: cashSession.id,
    payments: payments || undefined,
  };
  if (finalStatus === 'QUITADA') {
    updateData.closedAt = new Date();
  } else {
    // PARTIAL: mantém aberta temporalmente (sem closedAt definitivo)
    updateData.closedAt = null;
  }
  if (totalOverride != null && Number.isFinite(Number(totalOverride))) {
    updateData.total = Number(totalOverride);
  }

  const comanda = await tx.comanda.update({
    where: { id: comandaId },
    data: updateData,
    include: { items: true },
  });

  return { comanda, movements };
}

/**
 * Estorno: remove movimentos COMANDA, reabre comanda, restaura estoque e apaga ProductSales.
 * Ledger: contra-lançamento (INCOME OUT) em vez de apagar entradas.
 * Aceita QUITADA ou PARTIAL.
 */
async function reverseSettleComandaInTx(tx, {
  tenantId,
  comanda,
  restoreStock = true,
  userId,
}) {
  const st = String(comanda.status || '').toUpperCase();
  if (st !== 'QUITADA' && st !== 'PARTIAL') {
    const err = new Error('Só é possível estornar comanda quitada ou parcial.');
    err.code = 'NOT_QUITADA';
    err.status = 409;
    throw err;
  }

  const existingMovements = await tx.cashMovement.findMany({
    where: {
      tenantId,
      referenceType: 'Comanda',
      referenceId: comanda.id,
      source: 'COMANDA',
    },
  });

  const reverseDesc = `Estorno comanda #${comanda.number}`;
  for (const mov of existingMovements) {
    await writeLedgerEntry(tx, {
      tenantId,
      kind: 'INCOME',
      amount: Number(mov.amount || 0),
      direction: 'OUT',
      method: mov.method || null,
      account: 'CAIXA',
      referenceType: 'Comanda',
      referenceId: comanda.id,
      description: reverseDesc,
      createdById: userId || null,
    });
  }

  await tx.cashMovement.deleteMany({
    where: {
      tenantId,
      referenceType: 'Comanda',
      referenceId: comanda.id,
      source: 'COMANDA',
    },
  });

  await tx.comandaPayment.deleteMany({
    where: { tenantId, comandaId: comanda.id },
  });

  const linkedSales = await tx.productSale.findMany({
    where: { tenantId, comandaId: comanda.id },
  });

  if (linkedSales.length > 0) {
    for (const sale of linkedSales) {
      await tx.product.update({
        where: { id: Number(sale.productId) },
        data: { stock: { increment: Math.max(1, Number(sale.quantity || 1)) } },
      });
    }
    await tx.productSale.deleteMany({
      where: { tenantId, comandaId: comanda.id },
    });
  } else if (restoreStock && st === 'QUITADA') {
    // Fallback: comandas quitadas antes do vínculo comandaId
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
        paidAmount: 0,
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

const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'];
const DEFAULT_CARD_FEE_SEED = [
  { brand: 'Visa', kind: 'DEBIT', feePct: 1.5 },
  { brand: 'Visa', kind: 'CREDIT', feePct: 2.5 },
  { brand: 'Mastercard', kind: 'DEBIT', feePct: 1.5 },
  { brand: 'Mastercard', kind: 'CREDIT', feePct: 2.5 },
  { brand: 'Elo', kind: 'DEBIT', feePct: 1.6 },
  { brand: 'Elo', kind: 'CREDIT', feePct: 2.7 },
  { brand: 'Amex', kind: 'DEBIT', feePct: 2.0 },
  { brand: 'Amex', kind: 'CREDIT', feePct: 3.2 },
  { brand: 'Hipercard', kind: 'DEBIT', feePct: 1.8 },
  { brand: 'Hipercard', kind: 'CREDIT', feePct: 2.9 },
  { brand: 'Outra', kind: 'DEBIT', feePct: 2.0 },
  { brand: 'Outra', kind: 'CREDIT', feePct: 3.0 },
];

function isCardPaymentMethod(method) {
  const m = String(method || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return m.includes('cartao');
}

function inferCardKindFromMethod(method, explicitKind) {
  const k = String(explicitKind || '').toUpperCase();
  if (k === 'DEBIT' || k === 'CREDIT') return k;
  const m = String(method || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (m.includes('debito')) return 'DEBIT';
  if (m.includes('credito')) return 'CREDIT';
  return null;
}

function normalizeCardBrand(brand) {
  const raw = String(brand || '').trim();
  if (!raw) return null;
  const found = CARD_BRANDS.find((b) => b.toLowerCase() === raw.toLowerCase());
  return found || 'Outra';
}

async function ensureDefaultCardFeeRates(tenantId, db = prisma) {
  const count = await db.cardFeeRate.count({ where: { tenantId } });
  if (count > 0) return;
  await db.cardFeeRate.createMany({
    data: DEFAULT_CARD_FEE_SEED.map((row) => ({
      tenantId,
      brand: row.brand,
      kind: row.kind,
      feePct: row.feePct,
      active: true,
    })),
    skipDuplicates: true,
  });
}

async function resolveCardFeePct(tx, { tenantId, brand, kind }) {
  const normalizedBrand = normalizeCardBrand(brand);
  const normalizedKind = String(kind || '').toUpperCase() === 'DEBIT' ? 'DEBIT' : 'CREDIT';
  if (!normalizedBrand) {
    const err = new Error('Informe a bandeira do cartão.');
    err.code = 'CARD_BRAND_REQUIRED';
    err.status = 400;
    throw err;
  }
  await ensureDefaultCardFeeRates(tenantId, tx);
  const rate = await tx.cardFeeRate.findFirst({
    where: {
      tenantId,
      brand: normalizedBrand,
      kind: normalizedKind,
      active: true,
    },
  });
  const feePct = rate ? Number(rate.feePct || 0) : 0;
  return { brand: normalizedBrand, kind: normalizedKind, feePct: clampPct(feePct, 0) };
}

/**
 * Enriquece splits de cartão com feePct/feeAmount; exige bandeira.
 * @returns {Promise<object[]>}
 */
async function enrichCardSplits(tx, tenantId, splits) {
  const out = [];
  for (const split of splits || []) {
    const amount = Number(split.amount || 0);
    const method = String(split.method || 'Outro');
    if (!isCardPaymentMethod(method) || !(amount > 0)) {
      out.push({ ...split, amount, method });
      continue;
    }
    const cardKind = inferCardKindFromMethod(method, split.cardKind);
    if (!cardKind) {
      const err = new Error('Informe se o cartão é débito ou crédito.');
      err.code = 'CARD_KIND_REQUIRED';
      err.status = 400;
      throw err;
    }
    const brand = normalizeCardBrand(split.cardBrand);
    if (!brand) {
      const err = new Error('Informe a bandeira do cartão.');
      err.code = 'CARD_BRAND_REQUIRED';
      err.status = 400;
      throw err;
    }
    const { feePct } = await resolveCardFeePct(tx, { tenantId, brand, kind: cardKind });
    const feeAmount = Math.round(amount * (feePct / 100) * 100) / 100;
    out.push({
      ...split,
      amount,
      method,
      cardKind,
      cardBrand: brand,
      feePct,
      feeAmount,
    });
  }
  return out;
}

/**
 * Rateia taxas de cartão dos splits entre barbeiros dos itens SERVICE (proporcional ao total).
 */
function allocateCardFeesToBarbers(splits, items, comandaBarberId) {
  const totalCardFee = (splits || []).reduce((s, p) => s + Number(p.feeAmount || 0), 0);
  const serviceItems = (items || []).filter((i) => String(i.itemType).toUpperCase() === 'SERVICE');
  const weightByBarber = new Map();
  let weightTotal = 0;
  for (const item of serviceItems) {
    const bid = Number(item.barberId || comandaBarberId || 0);
    if (!bid) continue;
    const w = Number(item.total || 0);
    if (!(w > 0)) continue;
    weightByBarber.set(bid, (weightByBarber.get(bid) || 0) + w);
    weightTotal += w;
  }

  const byBarber = [];
  if (totalCardFee > 0 && weightTotal > 0) {
    let allocated = 0;
    const entries = [...weightByBarber.entries()];
    entries.forEach(([barberId, weight], idx) => {
      let feeAmount;
      if (idx === entries.length - 1) {
        feeAmount = Math.round((totalCardFee - allocated) * 100) / 100;
      } else {
        feeAmount = Math.round(totalCardFee * (weight / weightTotal) * 100) / 100;
        allocated += feeAmount;
      }
      byBarber.push({ barberId, feeAmount });
    });
  }

  return {
    cardFeeTotal: Math.round(totalCardFee * 100) / 100,
    cardFeeByBarber: byBarber,
  };
}

function cardFeeForBarber(payments, barberId) {
  const list = Array.isArray(payments?.cardFeeByBarber) ? payments.cardFeeByBarber : [];
  const row = list.find((r) => Number(r.barberId) === Number(barberId));
  return Number(row?.feeAmount || 0);
}

module.exports = {
  DEFAULT_CATEGORIES,
  DEFAULT_BARBER_COMMISSION_PCT,
  CARD_BRANDS,
  DEFAULT_CARD_FEE_SEED,
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
  assertCatalogProductItems,
  computePayableTotal,
  resolveServiceCommissionMeta,
  resolveServiceCommissionPct,
  clampPct,
  splitItemCommission,
  isCardPaymentMethod,
  inferCardKindFromMethod,
  normalizeCardBrand,
  ensureDefaultCardFeeRates,
  resolveCardFeePct,
  enrichCardSplits,
  allocateCardFeesToBarbers,
  cardFeeForBarber,
  toLocalDateIso,
  brazilDayBounds,
  comandaSettlementDate,
  writeLedgerEntry,
  writeAuditLog,
  assertPeriodNotClosed,
  sumComandaPaidAmount,
};
