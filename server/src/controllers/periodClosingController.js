const prisma = require('../lib/prisma.js');
const { indexBarbersById, buildCommissionReport } = require('../utils/commission.cjs');

const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

function parseDateStr(s) {
  if (!s || !ISO_DATE_RE.test(String(s).trim())) return null;
  return String(s).trim();
}

function daysBetweenInclusive(start, end) {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  return Math.floor((b - a) / (86400 * 1000)) + 1;
}

/** Garante JSON válido para JSONB (NaN/Infinity → null). */
function sanitizeSnapshotForJson(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSnapshotForJson(item));
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = sanitizeSnapshotForJson(v);
  }
  return out;
}

/** @param {'create' | 'list'} mode */
function periodClosingSchemaIssue(error, mode = 'create') {
  const msg = String(error?.message || '');
  const actionLabel = mode === 'list' ? 'Erro ao listar fechamentos' : 'Erro ao registar fechamento';
  if (error?.code === 'P2021') {
    return {
      status: 503,
      body: {
        error: actionLabel,
        details:
          'Base de dados desactualizada: execute as migrações Prisma (tabela ou coluna em falta, ex.: FinancialPeriodClosing).',
      },
    };
  }
  if (msg.includes('FinancialPeriodClosing') || msg.toLowerCase().includes('financialperiodclosing')) {
    return {
      status: 503,
      body: {
        error: actionLabel,
        details: 'Base de dados desactualizada: na pasta server execute `npx prisma migrate deploy` e reinicie a API.',
      },
    };
  }
  return null;
}

/**
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {{ shop: boolean, barberId?: number }} scopeOpts
 */
async function buildSnapshotForPeriod(tenantId, startDate, endDate, scopeOpts) {
  const { shop, barberId } = scopeOpts;

  const [barbers, appointmentsRaw, salesRaw, periodExpenses] = await Promise.all([
    prisma.barber.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        status: 'Finalizado',
        date: { gte: startDate, lte: endDate },
      },
    }),
    prisma.productSale.findMany({
      where: { tenantId, date: { gte: startDate, lte: endDate } },
    }),
    shop
      ? prisma.expense.findMany({
          where: { tenantId, date: { gte: startDate, lte: endDate } },
        })
      : Promise.resolve([]),
  ]);

  let appointments = appointmentsRaw;
  let sales = salesRaw;

  if (!shop && barberId != null) {
    const bid = Number(barberId);
    appointments = appointments.filter((a) => Number(a.barberId) === bid);
    sales = sales.filter((x) => Number(x.barberId) === bid);
  }

  const serviceRevenue = appointments.reduce((s, a) => s + Number(a.price || 0), 0);
  const productRevenue = sales.reduce((s, x) => s + Number(x.price || 0) * Number(x.quantity || 0), 0);
  const productCost = sales.reduce((s, x) => s + Number(x.cost || 0) * Number(x.quantity || 0), 0);
  const expenses = periodExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const revenue = serviceRevenue + productRevenue;

  const barbersById = indexBarbersById(barbers);
  const filterBarberId = shop ? null : barberId;
  const commissionReport = buildCommissionReport(appointments, barbersById, {
    aggregateByBarber: false,
    filterBarberId,
  });
  const repasseServicos = commissionReport.totals.totalBarber;
  const retencaoCasaServicos = commissionReport.totals.totalHouse;
  const netProfit = revenue - repasseServicos - expenses - productCost;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const itemsCount = appointments.length + sales.length;

  let barberName = null;
  if (!shop && barberId != null) {
    const b = barbers.find((x) => Number(x.id) === Number(barberId));
    barberName = b?.name || null;
  }

  return {
    startDate,
    endDate,
    scope: shop ? 'SHOP' : 'BARBER',
    barberId: shop ? 0 : Number(barberId),
    barberName,
    revenue,
    serviceRevenue,
    productRevenue,
    productCost,
    expenses,
    repasseServicos,
    retencaoCasaServicos,
    netProfit,
    netMargin,
    averageTicket: itemsCount > 0 ? revenue / itemsCount : 0,
    appointmentCount: appointments.length,
    saleCount: sales.length,
    expenseCount: periodExpenses.length,
  };
}

const getPeriodClosings = async (req, res) => {
  try {
    const role = req.user?.role;
    if (role === 'Gerente') {
      const rows = await prisma.financialPeriodClosing.findMany({
        where: tenantWhere(req),
        orderBy: { closedAt: 'desc' },
      });
      return res.json(rows);
    }
    if (role === 'Barbeiro') {
      const uid = Number(req.user.id);
      const rows = await prisma.financialPeriodClosing.findMany({
        where: { ...tenantWhere(req), scope: 'BARBER', barberId: uid },
        orderBy: { closedAt: 'desc' },
      });
      return res.json(rows);
    }
    return res.json([]);
  } catch (error) {
    const schemaIssue = periodClosingSchemaIssue(error, 'list');
    console.error('getPeriodClosings', {
      code: error?.code,
      meta: error?.meta,
      message: error?.message,
      stack: error?.stack,
    });
    if (schemaIssue) {
      return res.status(schemaIssue.status).json(schemaIssue.body);
    }
    return res.status(500).json({ error: 'Erro ao listar fechamentos' });
  }
};

const createPeriodClosing = async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Gerente' && role !== 'Barbeiro') {
    return res.status(403).json({ error: 'Sem permissão para registar fechamento.' });
  }

  const { startDate: rawStart, endDate: rawEnd, scope: rawScope, barberId: rawBarberId, notes } = req.body || {};
  const startDate = parseDateStr(rawStart);
  const endDate = parseDateStr(rawEnd);
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Informe startDate e endDate no formato YYYY-MM-DD.' });
  }
  if (startDate > endDate) {
    return res.status(400).json({ error: 'A data inicial não pode ser posterior à data final.' });
  }
  const span = daysBetweenInclusive(startDate, endDate);
  if (span > MAX_RANGE_DAYS) {
    return res.status(400).json({ error: `O intervalo não pode exceder ${MAX_RANGE_DAYS} dias.` });
  }

  let scope = String(rawScope || '').trim().toUpperCase();
  let targetBarberId = 0;

  if (role === 'Barbeiro') {
    scope = 'BARBER';
    targetBarberId = Number(req.user.id);
  } else if (role === 'Gerente') {
    if (scope !== 'SHOP' && scope !== 'BARBER') {
      return res.status(400).json({ error: 'Indique scope: SHOP ou BARBER.' });
    }
    if (scope === 'SHOP') {
      targetBarberId = 0;
    } else {
      const bid = Number(rawBarberId);
      if (!Number.isFinite(bid) || bid <= 0) {
        return res.status(400).json({ error: 'Para scope BARBER, informe barberId válido.' });
      }
      const b = await prisma.barber.findFirst({
        where: {
          id: bid,
          tenantId: tenantIdFromReq(req),
          deletedAt: null,
          role: { in: ['Gerente', 'Barbeiro'] },
        },
      });
      if (!b) {
        return res.status(400).json({ error: 'Barbeiro não encontrado ou inactivo.' });
      }
      targetBarberId = bid;
    }
  }

  const closedById = req.user.id != null && req.user.id !== '' ? Number(req.user.id) : null;

  let closedByName = null;
  try {
    if (closedById != null && Number.isFinite(closedById)) {
      const barber = await prisma.barber.findUnique({ where: { id: closedById } });
      closedByName = barber?.name || null;
    }
  } catch (_) {
    /* ignore */
  }

  try {
    const tenantId = tenantIdFromReq(req);
    const snapshot = await buildSnapshotForPeriod(tenantId, startDate, endDate, {
      shop: scope === 'SHOP',
      barberId: scope === 'BARBER' ? targetBarberId : null,
    });

    const snapshotJson = sanitizeSnapshotForJson(snapshot);

    const created = await prisma.financialPeriodClosing.create({
      data: {
        tenantId,
        startDate,
        endDate,
        scope,
        barberId: targetBarberId,
        closedById,
        closedByName,
        snapshot: snapshotJson,
        notes: notes && String(notes).trim() ? String(notes).trim().slice(0, 2000) : null,
      },
    });
    return res.status(201).json(created);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe fechamento para este período, âmbito e profissional.' });
    }
    const schemaIssue = periodClosingSchemaIssue(error);
    console.error('createPeriodClosing', {
      code: error?.code,
      meta: error?.meta,
      message: error?.message,
      stack: error?.stack,
    });
    if (schemaIssue) {
      return res.status(schemaIssue.status).json(schemaIssue.body);
    }
    return res.status(500).json({
      error: 'Erro ao registar fechamento',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
};

module.exports = {
  getPeriodClosings,
  createPeriodClosing,
  buildSnapshotForPeriod,
};
