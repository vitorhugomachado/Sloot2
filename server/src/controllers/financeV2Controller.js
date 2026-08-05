const prisma = require('../lib/prisma.js');
const { tenantIdFromReq } = require('../lib/tenantHelpers');
const {
  ensureFinanceCategories,
  getOpenCashSession,
  comandaSettlementDate,
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

const listCategories = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const cats = await ensureFinanceCategories(tenantId);
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar categorias' });
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

    if ((existing.status === 'PAID' || existing.paidAt) && req.body.amount != null) {
      // allow editing metadata of paid expenses, but warn on amount change via UI; still allow gerente edit of unpaid fields
    }

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

    const paidAt = new Date().toISOString().slice(0, 10);
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

      if (cashSessionId) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId,
            type: 'OUT',
            source: 'EXPENSE',
            amount: Number(expense.amount || 0),
            method: paymentMethod,
            description: expense.title || expense.description,
            referenceType: 'Expense',
            referenceId: expense.id,
            createdById: req.user?.id || null,
          },
        });
      }

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

    const { comandaSettlementDate, splitItemCommission } = require('../lib/financeV2');

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

    const rows = [];
    const byBarberMap = new Map();
    let totalGross = 0;
    let totalBarber = 0;
    let totalHouse = 0;

    for (const c of filtered) {
      for (const item of c.items || []) {
        if (String(item.itemType).toUpperCase() !== 'SERVICE') continue;
        const bid = Number(item.barberId || c.barberId || 0);
        if (barberId && bid !== barberId) continue;
        const { barber, house, pct } = splitItemCommission(item.total, item.commissionPct);
        totalGross += Number(item.total || 0);
        totalBarber += barber;
        totalHouse += house;

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
          barberPayout: barber,
          houseShare: house,
        });

        const prev = byBarberMap.get(bid) || {
          barberId: bid || null,
          barberName: barberNameById[bid] || '—',
          totalGross: 0,
          totalBarber: 0,
          totalHouse: 0,
          count: 0,
        };
        prev.totalGross += Number(item.total || 0);
        prev.totalBarber += barber;
        prev.totalHouse += house;
        prev.count += 1;
        byBarberMap.set(bid, prev);
      }
    }

    res.json({
      rows,
      byBarber: Array.from(byBarberMap.values()).sort((a, b) => b.totalBarber - a.totalBarber),
      totals: {
        totalGross,
        totalBarber,
        totalHouse,
        count: rows.length,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao calcular comissões' });
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
        where: { tenantId, status: 'OPEN' },
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
    const startMonth = String(req.query.startMonth || ''); // YYYY-MM
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

module.exports = {
  listCategories,
  listFinanceExpenses,
  createFinanceExpense,
  updateFinanceExpense,
  payFinanceExpense,
  deleteFinanceExpense,
  reverseFinanceExpense,
  getLedgerSummary,
  getCashFlow,
  getCommissions,
};
