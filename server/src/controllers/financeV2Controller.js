const prisma = require('../lib/prisma.js');
const { tenantIdFromReq } = require('../lib/tenantHelpers');
const {
  ensureFinanceCategories,
  getOpenCashSession,
  comandaSettlementDate,
  writeLedgerEntry,
  writeAuditLog,
  assertPeriodNotClosed,
  toLocalDateIso,
  resolveStaffName,
  summarizeSessionMovements,
  splitItemCommission,
  brazilDayBounds,
  ensureDefaultCardFeeRates,
  CARD_BRANDS,
} = require('../lib/financeV2');

function requireGerente(req, res) {
  if (req.user?.role !== 'Gerente') {
    res.status(403).json({ error: 'Apenas gestão pode realizar esta ação.' });
    return false;
  }
  return true;
}

function expenseStatusForDates({ status, dueDate, paidAt }) {
  if (status === 'PAID' || paidAt) return 'PAID';
  if (!dueDate) return status || 'PENDING';
  const due = new Date(`${dueDate}T23:59:59`);
  const now = new Date();
  if (due < now) return 'OVERDUE';
  const week = new Date();
  week.setDate(week.getDate() + 7);
  if (due <= week) return 'DUE_WEEK';
  return 'PENDING';
}

function slugify(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'categoria';
}

function methodGoesThroughCash(method) {
  const m = String(method || '').toUpperCase();
  return m === 'CAIXA' || m === 'DINHEIRO' || m === 'PIX' || m.includes('DINHEIRO') || m.includes('PIX');
}

async function sumAccountBalance(tenantId, account, tx = prisma) {
  const rows = await tx.accountMovement.findMany({
    where: { tenantId, account: String(account).toUpperCase() },
    select: { type: true, amount: true },
  });
  let bal = 0;
  for (const r of rows) {
    const amt = Number(r.amount || 0);
    const t = String(r.type || '').toUpperCase();
    if (t === 'IN') bal += amt;
    else if (t === 'OUT') bal -= amt;
    else if (t === 'TRANSFER') {
      // TRANSFER rows are signed by convention: OUT from account, IN to account
      // We store separate IN/OUT rows for transfers, so TRANSFER type alone shouldn't appear.
      bal -= amt;
    }
  }
  return Math.round(bal * 100) / 100;
}

async function buildDreForMonth(tenantId, month) {
  // month = YYYY-MM
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;

  const [comandas, expenses, payouts] = await Promise.all([
    prisma.comanda.findMany({
      where: { tenantId, status: 'QUITADA' },
      include: { items: true },
    }),
    prisma.expense.findMany({
      where: { tenantId },
      include: { financeCategory: true },
    }),
    prisma.commissionPayout.findMany({
      where: {
        tenantId,
        periodStart: { lte: end },
        periodEnd: { gte: start },
      },
    }),
  ]);

  const settled = comandas.filter((c) => {
    const d = comandaSettlementDate(c);
    return d >= start && d <= end;
  });

  let revenueGross = 0;
  let discounts = 0;
  let tips = 0;
  for (const c of settled) {
    const p = c.payments || {};
    const itemsTotal = Number(p.itemsTotal ?? c.total ?? 0);
    const disc = Number(p.discountAmount ?? p.discount ?? 0);
    const tip = Number(p.tipAmount ?? p.tip ?? 0);
    revenueGross += itemsTotal;
    discounts += disc;
    tips += tip;
  }
  const revenueNet = Math.round((revenueGross - discounts + tips) * 100) / 100;

  let commissions = 0;
  for (const c of settled) {
    for (const item of c.items || []) {
      if (String(item.itemType).toUpperCase() !== 'SERVICE') continue;
      const { barber } = splitItemCommission(item.total, item.commissionPct);
      commissions += barber;
    }
  }
  // Prefer payouts if any in period for DRE commissions line? Spec says commissions — use accrued from items
  const payoutsSum = payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  if (payoutsSum > 0 && commissions === 0) commissions = payoutsSum;

  const paidExpenses = expenses.filter((e) => {
    if (e.status !== 'PAID' && !e.paidAt) return false;
    const d = String(e.paidAt || e.date || '').slice(0, 10);
    return d >= start && d <= end;
  });

  const byCat = new Map();
  for (const e of paidExpenses) {
    const name = e.financeCategory?.name || e.category || 'Outros';
    const prev = byCat.get(name) || { category: name, amount: 0 };
    prev.amount += Number(e.amount || 0);
    byCat.set(name, prev);
  }
  const expensesByCategory = Array.from(byCat.values()).sort((a, b) => b.amount - a.amount);
  const expensesTotal = expensesByCategory.reduce((s, x) => s + x.amount, 0);
  const result = Math.round((revenueNet - commissions - expensesTotal) * 100) / 100;

  return {
    month,
    period: { start, end },
    revenueGross: Math.round(revenueGross * 100) / 100,
    discounts: Math.round(discounts * 100) / 100,
    tips: Math.round(tips * 100) / 100,
    revenueNet,
    commissions: Math.round(commissions * 100) / 100,
    expensesByCategory,
    expensesTotal: Math.round(expensesTotal * 100) / 100,
    result,
  };
}

const listCategories = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const cats = await ensureFinanceCategories(tenantId);
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar categorias' });
  }
};

const createCategory = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const name = String(req.body.name || '').trim();
    const kind = String(req.body.kind || '').toUpperCase();
    if (!name || !['INCOME', 'EXPENSE'].includes(kind)) {
      return res.status(400).json({ error: 'Informe name e kind (INCOME|EXPENSE).' });
    }
    await ensureFinanceCategories(tenantId);
    const slug = req.body.slug ? String(req.body.slug) : slugify(name);
    const parentId = req.body.parentId ? Number(req.body.parentId) : null;
    try {
      const cat = await prisma.financeCategory.create({
        data: {
          tenantId,
          name,
          kind,
          slug,
          parentId: Number.isFinite(parentId) && parentId > 0 ? parentId : null,
        },
      });
      res.status(201).json(cat);
    } catch (e) {
      if (e?.code === 'P2002') {
        return res.status(409).json({ error: 'Já existe categoria com este nome neste tipo.' });
      }
      throw e;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
};

const updateCategory = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.financeCategory.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

    const data = {};
    if (req.body.name != null) data.name = String(req.body.name).trim();
    if (req.body.kind != null) data.kind = String(req.body.kind).toUpperCase();
    if (req.body.slug != null) data.slug = String(req.body.slug);
    if (req.body.parentId !== undefined) {
      data.parentId = req.body.parentId ? Number(req.body.parentId) : null;
    }
    try {
      const updated = await prisma.financeCategory.update({ where: { id }, data });
      res.json(updated);
    } catch (e) {
      if (e?.code === 'P2002') {
        return res.status(409).json({ error: 'Já existe categoria com este nome neste tipo.' });
      }
      throw e;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.financeCategory.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

    const [expCount, comCount] = await Promise.all([
      prisma.expense.count({ where: { tenantId, categoryId: id } }),
      prisma.comanda.count({ where: { tenantId, categoryId: id } }),
    ]);
    if (expCount > 0 || comCount > 0) {
      return res.status(409).json({
        error: 'Categoria vinculada a despesas ou comandas. Remova os vínculos antes de excluir.',
        code: 'CATEGORY_IN_USE',
        expenses: expCount,
        comandas: comCount,
      });
    }
    await prisma.financeCategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir categoria' });
  }
};

const listFinanceExpenses = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') return res.json([]);
    const tenantId = tenantIdFromReq(req);
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;
    const q = String(req.query.q || '').trim();
    const dateType = String(req.query.dateType || 'due').toLowerCase();

    const dateField =
      dateType === 'competence' ? 'competenceDate'
        : dateType === 'paid' || dateType === 'quitacao' ? 'paidAt'
          : 'dueDate';

    const expenses = await prisma.expense.findMany({
      where: {
        tenantId,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { financeCategory: true },
      orderBy: { id: 'desc' },
      take: 300,
    });

    const filtered = expenses.filter((e) => {
      const raw = e[dateField] || e.dueDate || e.date || e.paidAt;
      if (!start && !end) return true;
      if (!raw) return false;
      const d = String(raw).slice(0, 10);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    }).map((e) => ({
      ...e,
      computedStatus: expenseStatusForDates(e),
    }));

    res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar despesas' });
  }
};

const createFinanceExpense = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const title = String(req.body.title || req.body.description || '').trim();
    const amount = Number(req.body.amount || 0);
    if (!title || !(amount > 0)) {
      return res.status(400).json({ error: 'Título e valor são obrigatórios' });
    }

    const dueDate = req.body.dueDate || req.body.date || new Date().toISOString().slice(0, 10);
    const competenceDate = req.body.competenceDate || dueDate;
    const account = String(req.body.account || 'CAIXA').toUpperCase();
    const payNow = Boolean(req.body.payNow || req.body.pagar);
    let cashSessionId = null;
    let status = 'PENDING';
    let paidAt = null;
    let paymentMethod = req.body.paymentMethod || null;

    if (payNow) {
      try {
        await assertPeriodNotClosed(tenantId, toLocalDateIso(new Date()));
      } catch (periodErr) {
        return res.status(periodErr.status || 409).json({
          error: periodErr.message,
          code: periodErr.code,
        });
      }
      if (account === 'CAIXA') {
        const session = await getOpenCashSession(tenantId);
        if (!session) {
          return res.status(409).json({
            error: 'Abra o caixa do dia antes de pagar uma saída no Caixa.',
            code: 'CASH_CLOSED',
          });
        }
        cashSessionId = session.id;
      }
      status = 'PAID';
      paidAt = new Date().toISOString().slice(0, 10);
      paymentMethod = paymentMethod || (account === 'CAIXA' ? 'Dinheiro' : 'Transferência');
    }

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          tenantId,
          description: title,
          title,
          amount,
          date: dueDate,
          dueDate,
          competenceDate,
          category: req.body.categoryName || req.body.category || 'Outros',
          categoryId: req.body.categoryId ? Number(req.body.categoryId) : null,
          account,
          supplier: req.body.supplier || null,
          costCenter: req.body.costCenter || null,
          paymentMethod,
          status,
          paidAt,
          invoiceNote: req.body.invoiceNote || null,
          notes: req.body.notes || null,
          cashSessionId,
        },
        include: { financeCategory: true },
      });

      if (payNow && cashSessionId) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId,
            type: 'OUT',
            source: 'EXPENSE',
            amount,
            method: paymentMethod || 'Dinheiro',
            description: title,
            referenceType: 'Expense',
            referenceId: created.id,
            createdById: req.user?.id || null,
          },
        });
      }

      if (payNow && account === 'BANCO') {
        await tx.accountMovement.create({
          data: {
            tenantId,
            account: 'BANCO',
            type: 'OUT',
            amount,
            date: paidAt,
            description: title,
            referenceType: 'Expense',
            referenceId: created.id,
            createdById: req.user?.id || null,
          },
        });
      }

      if (payNow) {
        await writeLedgerEntry(tx, {
          tenantId,
          kind: 'EXPENSE',
          amount,
          direction: 'OUT',
          method: paymentMethod,
          account,
          referenceType: 'Expense',
          referenceId: created.id,
          description: title,
          createdById: req.user?.id || null,
        });
        await writeAuditLog(tx, {
          tenantId,
          userId: req.user?.id,
          action: 'PAY_EXPENSE',
          entity: 'Expense',
          entityId: created.id,
          payload: { amount, account, payNow: true },
        });
      }

      return created;
    });

    res.status(201).json({ ...expense, computedStatus: expenseStatusForDates(expense) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar despesa' });
  }
};

const updateFinanceExpense = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.expense.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });

    const title = req.body.title != null ? String(req.body.title) : existing.title || existing.description;
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        title,
        description: title,
        amount: req.body.amount != null ? Number(req.body.amount) : existing.amount,
        dueDate: req.body.dueDate ?? existing.dueDate,
        competenceDate: req.body.competenceDate ?? existing.competenceDate,
        date: req.body.dueDate || req.body.date || existing.date,
        category: req.body.categoryName || req.body.category || existing.category,
        categoryId: req.body.categoryId != null && req.body.categoryId !== ''
          ? Number(req.body.categoryId)
          : existing.categoryId,
        account: req.body.account ?? existing.account,
        supplier: req.body.supplier ?? existing.supplier,
        costCenter: req.body.costCenter ?? existing.costCenter,
        paymentMethod: req.body.paymentMethod ?? existing.paymentMethod,
        invoiceNote: req.body.invoiceNote ?? existing.invoiceNote,
        notes: req.body.notes ?? existing.notes,
      },
      include: { financeCategory: true },
    });
    res.json({ ...updated, computedStatus: expenseStatusForDates(updated) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar despesa' });
  }
};

const payFinanceExpense = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.expense.findFirst({
      where: { id, tenantId },
      include: { financeCategory: true },
    });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });
    if (existing.status === 'PAID' || existing.paidAt) {
      return res.status(409).json({ error: 'Despesa já está paga.' });
    }

    const account = String(req.body.account || existing.account || 'CAIXA').toUpperCase();
    const paymentMethod = String(req.body.paymentMethod || existing.paymentMethod || 'Dinheiro');
    let cashSessionId = null;

    const paidAt = new Date().toISOString().slice(0, 10);
    try {
      await assertPeriodNotClosed(tenantId, paidAt);
    } catch (periodErr) {
      return res.status(periodErr.status || 409).json({
        error: periodErr.message,
        code: periodErr.code,
      });
    }

    if (account === 'CAIXA') {
      const session = await getOpenCashSession(tenantId);
      if (!session) {
        return res.status(409).json({
          error: 'Abra o caixa do dia antes de pagar esta despesa.',
          code: 'CASH_CLOSED',
        });
      }
      cashSessionId = session.id;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt,
          account,
          paymentMethod,
          cashSessionId,
        },
        include: { financeCategory: true },
      });

      const amount = Number(expense.amount || 0);
      const title = expense.title || expense.description;

      if (cashSessionId) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId,
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
            date: paidAt,
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

      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'PAY_EXPENSE',
        entity: 'Expense',
        entityId: expense.id,
        payload: { amount, account, paymentMethod },
      });

      return expense;
    });

    res.json({ ...updated, computedStatus: 'PAID' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao pagar despesa' });
  }
};

const deleteFinanceExpense = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.expense.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });
    if (existing.status === 'PAID' || existing.paidAt) {
      return res.status(409).json({
        error: 'Não é possível excluir despesa paga. Use o estorno.',
        code: 'EXPENSE_PAID',
      });
    }
    await prisma.expense.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir despesa' });
  }
};

const reverseFinanceExpense = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.expense.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });
    if (existing.status !== 'PAID' && !existing.paidAt) {
      return res.status(409).json({ error: 'Despesa não está paga.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (existing.cashSessionId) {
        await tx.cashMovement.deleteMany({
          where: {
            tenantId,
            referenceType: 'Expense',
            referenceId: existing.id,
            source: 'EXPENSE',
          },
        });
      }
      await tx.accountMovement.deleteMany({
        where: {
          tenantId,
          referenceType: 'Expense',
          referenceId: existing.id,
        },
      });
      await writeLedgerEntry(tx, {
        tenantId,
        kind: 'EXPENSE',
        amount: Number(existing.amount || 0),
        direction: 'IN',
        method: existing.paymentMethod,
        account: String(existing.account || 'CAIXA').toUpperCase(),
        referenceType: 'Expense',
        referenceId: existing.id,
        description: `Estorno despesa: ${existing.title || existing.description}`,
        createdById: req.user?.id || null,
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'REVERSE_EXPENSE',
        entity: 'Expense',
        entityId: existing.id,
        payload: { amount: existing.amount },
      });
      return tx.expense.update({
        where: { id },
        data: {
          status: 'PENDING',
          paidAt: null,
          cashSessionId: null,
        },
        include: { financeCategory: true },
      });
    });

    res.json({ ...updated, computedStatus: expenseStatusForDates(updated) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao estornar despesa' });
  }
};

const getCommissions = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;
    const barberId = req.query.barberId ? Number(req.query.barberId) : null;

    const comandas = await prisma.comanda.findMany({
      where: {
        tenantId,
        status: 'QUITADA',
        ...(barberId ? { OR: [{ barberId }, { items: { some: { barberId } } }] } : {}),
      },
      include: { items: true },
      orderBy: { closedAt: 'desc' },
      take: 500,
    });

    const filtered = comandas.filter((c) => {
      const d = comandaSettlementDate(c);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    const barberIds = new Set();
    for (const c of filtered) {
      for (const item of c.items || []) {
        if (item.barberId) barberIds.add(Number(item.barberId));
      }
      if (c.barberId) barberIds.add(Number(c.barberId));
    }

    const barbers = barberIds.size
      ? await prisma.barber.findMany({
          where: { tenantId, id: { in: [...barberIds] } },
          select: { id: true, name: true },
        })
      : [];
    const barberNameById = Object.fromEntries(barbers.map((b) => [b.id, b.name]));

    const payoutWhere = {
      tenantId,
      ...(barberId ? { barberId } : {}),
      ...(start || end
        ? {
            ...(start ? { periodEnd: { gte: start } } : {}),
            ...(end ? { periodStart: { lte: end } } : {}),
          }
        : {}),
    };
    const payouts = await prisma.commissionPayout.findMany({ where: payoutWhere });
    const paidByBarber = new Map();
    for (const p of payouts) {
      const bid = Number(p.barberId);
      paidByBarber.set(bid, (paidByBarber.get(bid) || 0) + Number(p.amount || 0));
    }

    const rows = [];
    const byBarberMap = new Map();
    let totalGross = 0;
    let totalBarber = 0;
    let totalHouse = 0;
    let totalCardFee = 0;

    // Debita a taxa de cartão no 1º item SERVICE de cada barbeiro na comanda
    const feeLeftByComandaBarber = new Map();
    for (const c of filtered) {
      const fees = Array.isArray(c.payments?.cardFeeByBarber) ? c.payments.cardFeeByBarber : [];
      for (const f of fees) {
        feeLeftByComandaBarber.set(`${c.id}:${Number(f.barberId)}`, Number(f.feeAmount || 0));
      }
    }

    for (const c of filtered) {
      for (const item of c.items || []) {
        if (String(item.itemType).toUpperCase() !== 'SERVICE') continue;
        const bid = Number(item.barberId || c.barberId || 0);
        if (barberId && bid !== barberId) continue;
        const { barber, house, pct } = splitItemCommission(item.total, item.commissionPct);
        totalGross += Number(item.total || 0);
        totalHouse += house;

        const feeKey = `${c.id}:${bid}`;
        const cardFeeDebit = Math.round((feeLeftByComandaBarber.get(feeKey) || 0) * 100) / 100;
        if (cardFeeDebit > 0) feeLeftByComandaBarber.set(feeKey, 0);

        const barberPayoutGross = Math.round(barber * 100) / 100;
        const barberPayout = Math.max(0, Math.round((barberPayoutGross - cardFeeDebit) * 100) / 100);
        totalBarber += barberPayout;
        totalCardFee += cardFeeDebit;

        const cardSplits = Array.isArray(c.payments?.splits)
          ? c.payments.splits.filter((s) => Number(s.feeAmount || 0) > 0)
          : [];
        const cardLabel = cardSplits
          .map((s) => `${s.cardBrand || 'Cartão'} ${s.cardKind === 'DEBIT' ? 'débito' : 'crédito'} ${s.feePct}%`)
          .filter(Boolean)
          .join(', ');

        rows.push({
          comandaId: c.id,
          comandaNumber: c.number,
          date: comandaSettlementDate(c),
          customerName: c.customerName,
          itemName: item.name,
          barberId: bid || null,
          barberName: barberNameById[bid] || '—',
          gross: Number(item.total || 0),
          commissionPct: pct,
          barberPayoutGross,
          cardFeeDebit,
          cardFeeLabel: cardFeeDebit > 0 ? cardLabel : '',
          barberPayout,
          houseShare: house,
        });

        const prev = byBarberMap.get(bid) || {
          barberId: bid || null,
          barberName: barberNameById[bid] || '—',
          totalGross: 0,
          totalBarber: 0,
          totalBarberGross: 0,
          totalCardFee: 0,
          totalHouse: 0,
          count: 0,
          paid: 0,
          owed: 0,
        };
        prev.totalGross += Number(item.total || 0);
        prev.totalBarberGross += barberPayoutGross;
        prev.totalBarber += barberPayout;
        prev.totalCardFee += cardFeeDebit;
        prev.totalHouse += house;
        prev.count += 1;
        byBarberMap.set(bid, prev);
      }
    }

    const byBarber = Array.from(byBarberMap.values()).map((b) => {
      const paid = paidByBarber.get(Number(b.barberId)) || 0;
      const owed = Math.max(0, Math.round((b.totalBarber - paid) * 100) / 100);
      return {
        ...b,
        totalBarberGross: Math.round(b.totalBarberGross * 100) / 100,
        totalCardFee: Math.round(b.totalCardFee * 100) / 100,
        totalBarber: Math.round(b.totalBarber * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        owed,
      };
    }).sort((a, b) => b.totalBarber - a.totalBarber);

    const totalPaid = byBarber.reduce((s, b) => s + b.paid, 0);
    const totalOwed = byBarber.reduce((s, b) => s + b.owed, 0);

    res.json({
      rows,
      byBarber,
      totals: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalBarber: Math.round(totalBarber * 100) / 100,
        totalHouse: Math.round(totalHouse * 100) / 100,
        totalCardFee: Math.round(totalCardFee * 100) / 100,
        totalPaid,
        totalOwed,
        count: rows.length,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao calcular comissões' });
  }
};

const listCommissionPayouts = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;
    const barberId = req.query.barberId ? Number(req.query.barberId) : null;

    const payouts = await prisma.commissionPayout.findMany({
      where: {
        tenantId,
        ...(barberId ? { barberId } : {}),
        ...(start ? { periodEnd: { gte: start } } : {}),
        ...(end ? { periodStart: { lte: end } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(payouts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar pagamentos de comissão' });
  }
};

const createCommissionPayout = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const barberId = Number(req.body.barberId);
    const amount = Number(req.body.amount || 0);
    const periodStart = String(req.body.periodStart || '').slice(0, 10);
    const periodEnd = String(req.body.periodEnd || '').slice(0, 10);
    const method = String(req.body.method || 'CAIXA');
    const notes = req.body.notes ? String(req.body.notes) : null;

    if (!Number.isFinite(barberId) || barberId <= 0) {
      return res.status(400).json({ error: 'Informe o profissional (barberId).' });
    }
    if (!(amount > 0)) {
      return res.status(400).json({ error: 'Valor do pagamento deve ser maior que zero.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      return res.status(400).json({ error: 'Informe periodStart e periodEnd (YYYY-MM-DD).' });
    }

    const barber = await prisma.barber.findFirst({
      where: { id: barberId, tenantId },
      select: { id: true, name: true },
    });
    if (!barber) return res.status(404).json({ error: 'Profissional não encontrado' });

    const throughCash = methodGoesThroughCash(method);
    let cashSessionId = req.body.cashSessionId ? Number(req.body.cashSessionId) : null;
    let session = null;
    if (throughCash) {
      session = cashSessionId
        ? await prisma.cashSession.findFirst({ where: { id: cashSessionId, tenantId, status: 'OPEN' } })
        : await getOpenCashSession(tenantId);
      if (!session) {
        return res.status(409).json({
          error: 'Abra o caixa do dia antes de pagar comissão pelo caixa.',
          code: 'CASH_CLOSED',
        });
      }
      cashSessionId = session.id;
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

    const payout = await prisma.$transaction(async (tx) => {
      const created = await tx.commissionPayout.create({
        data: {
          tenantId,
          barberId,
          periodStart,
          periodEnd,
          amount,
          method,
          cashSessionId: cashSessionId || null,
          notes,
          createdById: req.user?.id || null,
        },
      });

      if (throughCash && cashSessionId) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId,
            type: 'OUT',
            source: 'COMMISSION',
            amount,
            method: method === 'CAIXA' ? 'Dinheiro' : method,
            description: `Comissão — ${barber.name} (${periodStart} a ${periodEnd})`,
            referenceType: 'CommissionPayout',
            referenceId: created.id,
            createdById: req.user?.id || null,
          },
        });
      }

      await writeLedgerEntry(tx, {
        tenantId,
        kind: 'COMMISSION',
        amount,
        direction: 'OUT',
        method,
        account: throughCash ? 'CAIXA' : 'BANCO',
        referenceType: 'CommissionPayout',
        referenceId: created.id,
        description: `Pagamento comissão — ${barber.name}`,
        createdById: req.user?.id || null,
      });

      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'COMMISSION_PAYOUT',
        entity: 'CommissionPayout',
        entityId: created.id,
        payload: { barberId, amount, method, periodStart, periodEnd },
      });

      return created;
    });

    res.status(201).json(payout);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar pagamento de comissão' });
  }
};

const getAccountBalances = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const banco = await sumAccountBalance(tenantId, 'BANCO');

    let caixa = await sumAccountBalance(tenantId, 'CAIXA');
    const openSession = await getOpenCashSession(tenantId);
    let openSessionTotals = null;
    if (openSession) {
      const movements = await prisma.cashMovement.findMany({
        where: { tenantId, cashSessionId: openSession.id },
      });
      openSessionTotals = summarizeSessionMovements(movements, openSession.openingFloat);
      // Prefer open session expected cash when AccountMovement CAIXA is empty / secondary
      if (Math.abs(caixa) < 0.01) {
        caixa = Number(openSessionTotals.expectedCash || 0);
      }
    }

    res.json({
      CAIXA: caixa,
      BANCO: banco,
      openSession: openSession
        ? {
            id: openSession.id,
            openingFloat: openSession.openingFloat,
            totals: openSessionTotals,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao consultar saldos' });
  }
};

const transferAccounts = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const from = String(req.body.from || '').toUpperCase();
    const to = String(req.body.to || '').toUpperCase();
    const amount = Number(req.body.amount || 0);
    const description = String(req.body.description || 'Transferência entre contas').trim();

    if (!['CAIXA', 'BANCO'].includes(from) || !['CAIXA', 'BANCO'].includes(to) || from === to) {
      return res.status(400).json({ error: 'Informe from e to distintos (CAIXA|BANCO).' });
    }
    if (!(amount > 0)) {
      return res.status(400).json({ error: 'Valor da transferência deve ser maior que zero.' });
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

    let cashSessionId = req.body.cashSessionId ? Number(req.body.cashSessionId) : null;
    let session = null;
    if (from === 'CAIXA' || to === 'CAIXA') {
      session = cashSessionId
        ? await prisma.cashSession.findFirst({ where: { id: cashSessionId, tenantId, status: 'OPEN' } })
        : await getOpenCashSession(tenantId);
      if (!session) {
        return res.status(409).json({
          error: 'Abra o caixa do dia para transferências envolvendo o Caixa.',
          code: 'CASH_CLOSED',
        });
      }
      cashSessionId = session.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const outMov = await tx.accountMovement.create({
        data: {
          tenantId,
          account: from,
          type: 'OUT',
          amount,
          date: today,
          description,
          counterAccount: to,
          cashSessionId: cashSessionId || null,
          createdById: req.user?.id || null,
          referenceType: 'Transfer',
        },
      });
      const inMov = await tx.accountMovement.create({
        data: {
          tenantId,
          account: to,
          type: 'IN',
          amount,
          date: today,
          description,
          counterAccount: from,
          cashSessionId: cashSessionId || null,
          createdById: req.user?.id || null,
          referenceType: 'Transfer',
          referenceId: outMov.id,
        },
      });
      await tx.accountMovement.update({
        where: { id: outMov.id },
        data: { referenceId: inMov.id },
      });

      if (from === 'CAIXA' && cashSessionId) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId,
            type: 'OUT',
            source: 'ADJUSTMENT',
            amount,
            method: 'Transferência',
            description: `Transferência Caixa → ${to}: ${description}`,
            referenceType: 'AccountMovement',
            referenceId: outMov.id,
            createdById: req.user?.id || null,
          },
        });
      }
      if (to === 'CAIXA' && cashSessionId) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId,
            type: 'IN',
            source: 'ADJUSTMENT',
            amount,
            method: 'Transferência',
            description: `Transferência ${from} → Caixa: ${description}`,
            referenceType: 'AccountMovement',
            referenceId: inMov.id,
            createdById: req.user?.id || null,
          },
        });
      }

      await writeLedgerEntry(tx, {
        tenantId,
        kind: 'TRANSFER',
        amount,
        direction: 'OUT',
        method: 'Transferência',
        account: from,
        referenceType: 'AccountMovement',
        referenceId: outMov.id,
        description: `Transferência ${from} → ${to}: ${description}`,
        createdById: req.user?.id || null,
      });
      await writeLedgerEntry(tx, {
        tenantId,
        kind: 'TRANSFER',
        amount,
        direction: 'IN',
        method: 'Transferência',
        account: to,
        referenceType: 'AccountMovement',
        referenceId: inMov.id,
        description: `Transferência ${from} → ${to}: ${description}`,
        createdById: req.user?.id || null,
      });

      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: 'ACCOUNT_TRANSFER',
        entity: 'AccountMovement',
        entityId: outMov.id,
        payload: { from, to, amount, description },
      });

      return { out: outMov, in: inMov };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao transferir entre contas' });
  }
};

const listClosings = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const closings = await prisma.financeClosing.findMany({
      where: { tenantId },
      orderBy: { closedAt: 'desc' },
      take: 50,
    });
    res.json(closings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar fechamentos' });
  }
};

const createClosing = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const periodStart = String(req.body.periodStart || '').slice(0, 10);
    const periodEnd = String(req.body.periodEnd || '').slice(0, 10);
    const notes = req.body.notes ? String(req.body.notes) : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      return res.status(400).json({ error: 'Informe periodStart e periodEnd (YYYY-MM-DD).' });
    }
    if (periodEnd < periodStart) {
      return res.status(400).json({ error: 'periodEnd deve ser >= periodStart.' });
    }

    const existing = await prisma.financeClosing.findFirst({
      where: { tenantId, periodStart, periodEnd },
    });
    if (existing) {
      return res.status(409).json({ error: 'Já existe fechamento para este período.', code: 'ALREADY_CLOSED' });
    }

    const [comandas, expenses, payouts] = await Promise.all([
      prisma.comanda.findMany({
        where: { tenantId, status: 'QUITADA' },
      }),
      prisma.expense.findMany({ where: { tenantId } }),
      prisma.commissionPayout.findMany({
        where: {
          tenantId,
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
        },
      }),
    ]);

    const settled = comandas.filter((c) => {
      const d = comandaSettlementDate(c);
      return d >= periodStart && d <= periodEnd;
    });
    const paidExpenses = expenses.filter((e) => {
      if (e.status !== 'PAID' && !e.paidAt) return false;
      const d = String(e.paidAt || e.date || '').slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    });

    const [caixa, banco] = await Promise.all([
      sumAccountBalance(tenantId, 'CAIXA'),
      sumAccountBalance(tenantId, 'BANCO'),
    ]);
    const openSession = await getOpenCashSession(tenantId);
    let caixaSession = caixa;
    if (openSession && Math.abs(caixa) < 0.01) {
      const movements = await prisma.cashMovement.findMany({
        where: { tenantId, cashSessionId: openSession.id },
      });
      caixaSession = summarizeSessionMovements(movements, openSession.openingFloat).expectedCash;
    }

    const snapshot = {
      periodStart,
      periodEnd,
      comandasQuitada: {
        count: settled.length,
        total: settled.reduce((s, c) => s + Number(c.total || 0), 0),
        ids: settled.map((c) => c.id),
      },
      expensesPaid: {
        count: paidExpenses.length,
        total: paidExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
        ids: paidExpenses.map((e) => e.id),
      },
      payouts: {
        count: payouts.length,
        total: payouts.reduce((s, p) => s + Number(p.amount || 0), 0),
      },
      accountBalances: {
        CAIXA: caixaSession,
        BANCO: banco,
      },
    };

    const closedByName = await resolveStaffName(req.user?.id);
    const closing = await prisma.$transaction(async (tx) => {
      const created = await tx.financeClosing.create({
        data: {
          tenantId,
          periodStart,
          periodEnd,
          closedById: req.user?.id || null,
          closedByName: closedByName || null,
          snapshot,
          notes,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        userName: closedByName,
        action: 'FINANCE_CLOSING',
        entity: 'FinanceClosing',
        entityId: created.id,
        payload: { periodStart, periodEnd },
      });
      return created;
    });

    res.status(201).json(closing);
  } catch (error) {
    console.error(error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe fechamento para este período.' });
    }
    res.status(500).json({ error: 'Erro ao fechar período' });
  }
};

const getDre = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const month = String(req.query.month || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Informe month=YYYY-MM' });
    }
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const current = await buildDreForMonth(tenantId, month);
    const previousMonth = await buildDreForMonth(tenantId, prevMonth);

    res.json({
      ...current,
      previousMonth,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar DRE' });
  }
};

const getAuditLog = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;
    const action = req.query.action ? String(req.query.action) : null;

    const bounds = brazilDayBounds(start, end);
    const logs = await prisma.financeAuditLog.findMany({
      where: {
        tenantId,
        ...(action ? { action } : {}),
        ...(bounds ? { createdAt: bounds } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar auditoria' });
  }
};

const getKpis = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;

    const [comandas, tenant] = await Promise.all([
      prisma.comanda.findMany({
        where: { tenantId, status: 'QUITADA' },
        include: { items: true },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { monthlyRevenueGoal: true },
      }),
    ]);

    const settled = comandas.filter((c) => {
      const d = comandaSettlementDate(c);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    let revenue = 0;
    let discountTotal = 0;
    let tipsTotal = 0;
    let serviceTotal = 0;
    let productTotal = 0;
    /** @type {Map<number, { barberId: number, serviceRevenue: number, productRevenue: number, revenue: number, comandaIds: Set<number> }>} */
    const byBarberMap = new Map();

    const bumpBarber = (barberId, itemTotal, isProduct, comandaId) => {
      const id = Number(barberId);
      if (!Number.isFinite(id) || id <= 0) return;
      let row = byBarberMap.get(id);
      if (!row) {
        row = {
          barberId: id,
          serviceRevenue: 0,
          productRevenue: 0,
          revenue: 0,
          comandaIds: new Set(),
        };
        byBarberMap.set(id, row);
      }
      if (isProduct) row.productRevenue += itemTotal;
      else row.serviceRevenue += itemTotal;
      row.revenue += itemTotal;
      if (comandaId != null) row.comandaIds.add(Number(comandaId));
    };

    for (const c of settled) {
      const p = c.payments || {};
      revenue += Number(p.totalCheckout ?? c.total ?? 0);
      discountTotal += Number(p.discountAmount ?? p.discount ?? 0);
      tipsTotal += Number(p.tipAmount ?? p.tip ?? 0);
      for (const item of c.items || []) {
        const t = Number(item.total || 0);
        const isProduct = String(item.itemType).toUpperCase() === 'PRODUCT';
        if (isProduct) productTotal += t;
        else serviceTotal += t;
        bumpBarber(item.barberId || c.barberId, t, isProduct, c.id);
      }
    }

    const count = settled.length;
    const ticketMedio = count > 0 ? Math.round((revenue / count) * 100) / 100 : 0;
    const mixBase = serviceTotal + productTotal;
    const mixServicePct = mixBase > 0 ? Math.round((serviceTotal / mixBase) * 10000) / 100 : 0;
    const mixProductPct = mixBase > 0 ? Math.round((productTotal / mixBase) * 10000) / 100 : 0;
    const goal = tenant?.monthlyRevenueGoal != null ? Number(tenant.monthlyRevenueGoal) : null;
    const goalProgress = goal && goal > 0
      ? Math.round((revenue / goal) * 10000) / 100
      : null;

    const byBarber = Array.from(byBarberMap.values())
      .map((row) => {
        const cCount = row.comandaIds.size;
        const rev = Math.round(row.revenue * 100) / 100;
        return {
          barberId: row.barberId,
          serviceRevenue: Math.round(row.serviceRevenue * 100) / 100,
          productRevenue: Math.round(row.productRevenue * 100) / 100,
          revenue: rev,
          count: cCount,
          ticketMedio: cCount > 0 ? Math.round((rev / cCount) * 100) / 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      period: { start: start || null, end: end || null },
      ticketMedio,
      mixServicePct,
      mixProductPct,
      discountTotal: Math.round(discountTotal * 100) / 100,
      tipsTotal: Math.round(tipsTotal * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      comandaCount: count,
      monthlyRevenueGoal: goal,
      goalProgress,
      byBarber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao calcular KPIs' });
  }
};

const getLedgerSummary = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;

    const [comandasRaw, expenses, openComandas] = await Promise.all([
      prisma.comanda.findMany({
        where: {
          tenantId,
          status: 'QUITADA',
        },
      }),
      prisma.expense.findMany({ where: { tenantId } }),
      prisma.comanda.aggregate({
        where: { tenantId, status: { in: ['OPEN', 'PARTIAL'] } },
        _sum: { total: true },
      }),
    ]);

    const comandas = comandasRaw.filter((c) => {
      const d = comandaSettlementDate(c);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    const paidExpenses = expenses.filter((e) => {
      if (e.status !== 'PAID' && !e.paidAt) return false;
      const d = String(e.paidAt || e.date || '').slice(0, 10);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    const openExpenses = expenses
      .filter((e) => e.status !== 'PAID' && !e.paidAt)
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const receitas = comandas.reduce((s, c) => s + Number(c.total || 0), 0);
    const despesas = paidExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    const entries = [
      ...comandas.map((c) => ({
        id: `comanda-${c.id}`,
        kind: 'IN',
        date: comandaSettlementDate(c),
        title: `Comanda Nº${String(c.number).padStart(4, '0')} — ${c.customerName}`,
        paymentMethod: Array.isArray(c.payments?.splits)
          ? c.payments.splits.map((s) => s.method).filter(Boolean).join(', ')
          : '',
        category: 'Receitas de Vendas',
        amount: Number(c.total || 0),
        status: 'PAID',
        source: 'comanda',
        sourceId: c.id,
      })),
      ...paidExpenses.map((e) => ({
        id: `expense-${e.id}`,
        kind: 'OUT',
        date: String(e.paidAt || e.date || '').slice(0, 10),
        title: e.title || e.description,
        paymentMethod: e.paymentMethod || '',
        category: e.category || 'Despesas',
        amount: -Number(e.amount || 0),
        status: 'PAID',
        source: 'expense',
        sourceId: e.id,
      })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    res.json({
      summary: {
        totalReceitas: receitas,
        totalDespesas: despesas,
        resultado: receitas - despesas,
        emAberto: openExpenses + Number(openComandas._sum.total || 0),
      },
      entries,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao montar extrato' });
  }
};

const getCashFlow = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const startMonth = String(req.query.startMonth || '');
    const endMonth = String(req.query.endMonth || startMonth);
    const statusFilter = String(req.query.status || 'all').toLowerCase();

    if (!/^\d{4}-\d{2}$/.test(startMonth)) {
      return res.status(400).json({ error: 'Informe startMonth=YYYY-MM' });
    }

    const start = `${startMonth}-01`;
    const [ey, em] = endMonth.split('-').map(Number);
    const lastDay = new Date(ey, em, 0).getDate();
    const end = `${endMonth}-${String(lastDay).padStart(2, '0')}`;

    const categories = await ensureFinanceCategories(tenantId);
    const incomeCats = categories.filter((c) => c.kind === 'INCOME');
    const expenseCats = categories.filter((c) => c.kind === 'EXPENSE');

    const comandasRaw = await prisma.comanda.findMany({
      where: {
        tenantId,
        status: 'QUITADA',
      },
    });
    const comandas = comandasRaw.filter((c) => {
      const d = comandaSettlementDate(c);
      return d >= start && d <= end;
    });

    const expenses = await prisma.expense.findMany({
      where: { tenantId },
      include: { financeCategory: true },
    });

    const incomeTree = incomeCats.map((cat) => {
      const items = comandas.filter((c) =>
        (c.categoryId && c.categoryId === cat.id)
        || (!c.categoryId && cat.slug === 'receitas-de-vendas'),
      );
      const total = items.reduce((s, c) => s + Number(c.total || 0), 0);
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        total,
        children: items.map((c) => ({
          id: c.id,
          name: `Nº${String(c.number).padStart(4, '0')} — ${c.customerName}`,
          total: Number(c.total || 0),
        })),
      };
    });

    const expenseTree = expenseCats.map((cat) => {
      const items = expenses.filter((e) => {
        const d = String(e.competenceDate || e.dueDate || e.date || '').slice(0, 10);
        if (d < start || d > end) return false;
        if (statusFilter === 'paid' && e.status !== 'PAID' && !e.paidAt) return false;
        if (statusFilter === 'open' && (e.status === 'PAID' || e.paidAt)) return false;
        if (e.categoryId) return e.categoryId === cat.id;
        return (e.category || '').toLowerCase() === cat.name.toLowerCase();
      });
      const total = items.reduce((s, e) => s + Number(e.amount || 0), 0);
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        total: -total,
        children: items.map((e) => ({
          id: e.id,
          name: e.title || e.description,
          total: -Number(e.amount || 0),
        })),
      };
    });

    const totalReceitas = incomeTree.reduce((s, n) => s + n.total, 0);
    const totalDespesas = expenseTree.reduce((s, n) => s + n.total, 0);

    res.json({
      period: { start, end, startMonth, endMonth },
      receitas: { total: totalReceitas, categories: incomeTree },
      despesas: { total: totalDespesas, categories: expenseTree },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar fluxo de caixa' });
  }
};

const listCardFees = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    await ensureDefaultCardFeeRates(tenantId);
    const rows = await prisma.cardFeeRate.findMany({
      where: { tenantId },
      orderBy: [{ brand: 'asc' }, { kind: 'asc' }],
    });
    res.json({ brands: CARD_BRANDS, rates: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar taxas de cartão' });
  }
};

const upsertCardFee = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const brandRaw = String(req.body.brand || '').trim();
    const kind = String(req.body.kind || '').toUpperCase() === 'DEBIT' ? 'DEBIT' : 'CREDIT';
    const brand = CARD_BRANDS.find((b) => b.toLowerCase() === brandRaw.toLowerCase()) || brandRaw;
    if (!brand) return res.status(400).json({ error: 'Informe a bandeira.' });
    const feePct = Math.max(0, Math.min(100, Number(req.body.feePct)));
    if (!Number.isFinite(feePct)) return res.status(400).json({ error: 'feePct inválido.' });
    const active = req.body.active === false || req.body.active === 'false' ? false : true;

    const row = await prisma.cardFeeRate.upsert({
      where: {
        tenantId_brand_kind: { tenantId, brand, kind },
      },
      create: { tenantId, brand, kind, feePct, active },
      update: { feePct, active },
    });
    await writeAuditLog(prisma, {
      tenantId,
      userId: req.user?.id,
      action: 'UPSERT_CARD_FEE',
      entity: 'CardFeeRate',
      entityId: row.id,
      payload: { brand, kind, feePct, active },
    });
    res.json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar taxa de cartão' });
  }
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listFinanceExpenses,
  createFinanceExpense,
  updateFinanceExpense,
  payFinanceExpense,
  deleteFinanceExpense,
  reverseFinanceExpense,
  getLedgerSummary,
  getCashFlow,
  getCommissions,
  listCommissionPayouts,
  createCommissionPayout,
  getAccountBalances,
  transferAccounts,
  listClosings,
  createClosing,
  getDre,
  getAuditLog,
  getKpis,
  listCardFees,
  upsertCardFee,
};
