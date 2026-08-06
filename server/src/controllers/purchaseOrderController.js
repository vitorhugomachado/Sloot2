const prisma = require('../lib/prisma.js');
const { HEAVY_TX } = require('../lib/prisma.js');
const { tenantIdFromReq } = require('../lib/tenantHelpers');
const {
  ensureFinanceCategories,
  getOpenCashSession,
  writeLedgerEntry,
  writeAuditLog,
  assertPeriodNotClosed,
  toLocalDateIso,
} = require('../lib/financeV2');

const includeItems = {
  items: {
    include: { product: { select: { id: true, name: true, stock: true, cost: true, price: true, category: true } } },
    orderBy: { id: 'asc' },
  },
};

function requireGerente(req, res) {
  if (req.user?.role !== 'Gerente') {
    res.status(403).json({ error: 'Apenas gestão pode gerir pedidos de compra.' });
    return false;
  }
  return true;
}

function defaultAccountForMethod(paymentMethod, account) {
  if (account) {
    const a = String(account).toUpperCase();
    if (a === 'CAIXA' || a === 'BANCO') return a;
  }
  const m = String(paymentMethod || '').toLowerCase();
  if (m.includes('dinheiro')) return 'CAIXA';
  return 'BANCO';
}

/**
 * Resolve line items: existing productId or create Product when name provided.
 * @returns {Promise<{ lines: Array, orderTotal: number, createdProducts: Array }>}
 */
async function resolveOrderLines(tx, tenantId, itemsInput) {
  if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
    const err = new Error('Informe ao menos um item no pedido.');
    err.status = 400;
    err.code = 'ITEMS_REQUIRED';
    throw err;
  }

  const lines = [];
  const createdProducts = [];
  let orderTotal = 0;

  for (const raw of itemsInput) {
    const quantity = Math.trunc(Number(raw.quantity));
    const unitCost = Number(raw.unitCost != null ? raw.unitCost : raw.cost);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      const err = new Error('Cada item precisa de quantidade inteira maior que zero.');
      err.status = 400;
      err.code = 'INVALID_QUANTITY';
      throw err;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      const err = new Error('Cada item precisa de custo unitário válido.');
      err.status = 400;
      err.code = 'INVALID_UNIT_COST';
      throw err;
    }

    let productId = raw.productId ? Number(raw.productId) : null;
    let productName = '';

    if (productId) {
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId },
      });
      if (!product) {
        const err = new Error(`Produto #${productId} não encontrado.`);
        err.status = 404;
        err.code = 'PRODUCT_NOT_FOUND';
        throw err;
      }
      productName = product.name;
    } else {
      const name = String(raw.name || '').trim();
      if (!name) {
        const err = new Error('Informe productId ou nome para cadastrar um produto novo.');
        err.status = 400;
        err.code = 'PRODUCT_REQUIRED';
        throw err;
      }
      const price = Number(raw.price != null ? raw.price : unitCost);
      const cost = Number(raw.cost != null ? raw.cost : unitCost);
      const category = String(raw.category || 'Geral').trim() || 'Geral';
      const created = await tx.product.create({
        data: {
          tenantId,
          name,
          price: Number.isFinite(price) ? price : 0,
          cost: Number.isFinite(cost) ? cost : unitCost,
          stock: 0,
          category,
        },
      });
      productId = created.id;
      productName = created.name;
      createdProducts.push(created);
    }

    const lineTotal = Math.round(quantity * unitCost * 100) / 100;
    orderTotal += lineTotal;
    lines.push({
      productId,
      productName,
      quantity,
      unitCost,
      total: lineTotal,
    });
  }

  orderTotal = Math.round(orderTotal * 100) / 100;
  return { lines, orderTotal, createdProducts };
}

async function resolveVariableCostCategory(tx, tenantId) {
  const cats = await ensureFinanceCategories(tenantId, tx);
  const found =
    cats.find((c) => c.kind === 'EXPENSE' && c.slug === 'custo-variavel')
    || (await tx.financeCategory.findFirst({
      where: { tenantId, kind: 'EXPENSE', slug: 'custo-variavel' },
    }));
  return found || null;
}

const listPurchaseOrders = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const where = { tenantId };
    const status = String(req.query.status || '').trim().toUpperCase();
    if (status && ['OPEN', 'RECEIVED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }
    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: includeItems,
      orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
    });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar pedidos de compra' });
  }
};

const getPurchaseOrder = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: includeItems,
    });
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
};

const createPurchaseOrder = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const supplier = String(req.body.supplier || '').trim();
    const notes = req.body.notes != null ? String(req.body.notes) : null;

    const order = await prisma.$transaction(async (tx) => {
      const { lines, orderTotal, createdProducts } = await resolveOrderLines(
        tx,
        tenantId,
        req.body.items,
      );
      const created = await tx.purchaseOrder.create({
        data: {
          tenantId,
          supplier,
          notes,
          status: 'OPEN',
          total: orderTotal,
          items: { create: lines },
        },
        include: includeItems,
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'CREATE_PURCHASE_ORDER',
        entity: 'PurchaseOrder',
        entityId: created.id,
        payload: { total: orderTotal, itemCount: lines.length, newProducts: createdProducts.length },
      });
      return { order: created, createdProducts };
    }, HEAVY_TX);

    res.status(201).json({ ...order.order, createdProducts: order.createdProducts });
  } catch (error) {
    console.error(error);
    if (error?.status) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: 'Erro ao criar pedido de compra' });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (existing.status !== 'OPEN') {
      return res.status(409).json({
        error: 'Só é possível editar pedidos em aberto.',
        code: 'PO_NOT_OPEN',
      });
    }

    const supplier =
      req.body.supplier != null ? String(req.body.supplier).trim() : existing.supplier;
    const notes = req.body.notes !== undefined ? (req.body.notes != null ? String(req.body.notes) : null) : existing.notes;
    const itemsInput = req.body.items != null ? req.body.items : null;

    const order = await prisma.$transaction(async (tx) => {
      let total = existing.total;
      if (itemsInput) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        const { lines, orderTotal } = await resolveOrderLines(tx, tenantId, itemsInput);
        total = orderTotal;
        await tx.purchaseOrderItem.createMany({
          data: lines.map((l) => ({ ...l, purchaseOrderId: id })),
        });
      }
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { supplier, notes, total },
        include: includeItems,
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'UPDATE_PURCHASE_ORDER',
        entity: 'PurchaseOrder',
        entityId: id,
        payload: { total },
      });
      return updated;
    }, HEAVY_TX);

    res.json(order);
  } catch (error) {
    console.error(error);
    if (error?.status) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: 'Erro ao atualizar pedido' });
  }
};

const cancelPurchaseOrder = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (existing.status !== 'OPEN') {
      return res.status(409).json({
        error: 'Só é possível cancelar pedidos em aberto.',
        code: 'PO_NOT_OPEN',
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: includeItems,
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'CANCEL_PURCHASE_ORDER',
        entity: 'PurchaseOrder',
        entityId: id,
        payload: {},
      });
      return updated;
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cancelar pedido' });
  }
};

const receivePurchaseOrder = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const paymentMethod = String(req.body.paymentMethod || '').trim() || 'Dinheiro';
    const account = defaultAccountForMethod(paymentMethod, req.body.account);
    const today = toLocalDateIso(new Date());

    try {
      await assertPeriodNotClosed(tenantId, today);
    } catch (periodErr) {
      return res.status(periodErr.status || 409).json({
        error: periodErr.message,
        code: periodErr.code,
      });
    }

    let cashSession = null;
    if (account === 'CAIXA') {
      cashSession = await getOpenCashSession(tenantId);
      if (!cashSession) {
        return res.status(409).json({
          error: 'Abra o caixa do dia antes de receber o pedido com pagamento no Caixa.',
          code: 'CASH_CLOSED',
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });
      if (!existing) {
        const err = new Error('Pedido não encontrado');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      if (existing.status !== 'OPEN') {
        const err = new Error('Este pedido já foi recebido ou cancelado.');
        err.status = 409;
        err.code = 'PO_NOT_OPEN';
        throw err;
      }
      if (!existing.items.length) {
        const err = new Error('Pedido sem itens.');
        err.status = 400;
        err.code = 'ITEMS_REQUIRED';
        throw err;
      }

      for (const item of existing.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
        });
        if (!product) {
          const err = new Error(`Produto #${item.productId} não encontrado.`);
          err.status = 404;
          err.code = 'PRODUCT_NOT_FOUND';
          throw err;
        }
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: { increment: item.quantity },
            cost: item.unitCost,
          },
        });
      }

      const category = await resolveVariableCostCategory(tx, tenantId);
      const title = existing.supplier
        ? `Pedido de compra #${existing.id} — ${existing.supplier}`
        : `Pedido de compra #${existing.id}`;
      const amount = Number(existing.total || 0);

      const expense = await tx.expense.create({
        data: {
          tenantId,
          description: title,
          title,
          amount,
          date: today,
          dueDate: today,
          competenceDate: today,
          category: category?.name || 'Custo Variavel',
          categoryId: category?.id || null,
          account,
          supplier: existing.supplier || null,
          paymentMethod,
          status: 'PAID',
          paidAt: today,
          notes: existing.notes || null,
          cashSessionId: cashSession?.id || null,
        },
      });

      if (cashSession) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: cashSession.id,
            type: 'OUT',
            source: 'EXPENSE',
            amount,
            method: paymentMethod,
            description: title,
            referenceType: 'Expense',
            referenceId: expense.id,
            createdById: req.user?.id || null,
          },
        });
      }

      if (account === 'BANCO') {
        await tx.accountMovement.create({
          data: {
            tenantId,
            account: 'BANCO',
            type: 'OUT',
            amount,
            date: today,
            description: title,
            referenceType: 'Expense',
            referenceId: expense.id,
            createdById: req.user?.id || null,
          },
        });
      }

      await writeLedgerEntry(tx, {
        tenantId,
        kind: 'EXPENSE',
        amount,
        direction: 'OUT',
        method: paymentMethod,
        account,
        referenceType: 'Expense',
        referenceId: expense.id,
        description: title,
        createdById: req.user?.id || null,
      });

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
          expenseId: expense.id,
          paymentMethod,
          account,
        },
        include: includeItems,
      });

      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'RECEIVE_PURCHASE_ORDER',
        entity: 'PurchaseOrder',
        entityId: id,
        payload: {
          expenseId: expense.id,
          amount,
          paymentMethod,
          account,
        },
      });

      return { order: updated, expense };
    }, HEAVY_TX);

    res.json(result);
  } catch (error) {
    console.error(error);
    if (error?.status) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: 'Erro ao receber pedido de compra' });
  }
};

module.exports = {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
};
