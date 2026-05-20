const prisma = require('../lib/prisma.js');
const { indexBarbersById, buildCommissionReport } = require('../utils/commission.cjs');

const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Same local calendar day string as Finance.jsx getLocalDateStr */
function getLocalDateStr(d) {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().split('T')[0];
}

function monthBounds(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const startD = new Date(y, m - 1, 1);
  const endD = new Date(y, m, 0);
  return { startDate: getLocalDateStr(startD), endDate: getLocalDateStr(endD) };
}

async function buildSnapshotForMonth(tenantId, yearMonth) {
  const { startDate, endDate } = monthBounds(yearMonth);

  const [barbers, appointments, sales, periodExpenses] = await Promise.all([
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
    prisma.expense.findMany({
      where: { tenantId, date: { gte: startDate, lte: endDate } },
    }),
  ]);

  const serviceRevenue = appointments.reduce((s, a) => s + Number(a.price || 0), 0);
  const productRevenue = sales.reduce((s, x) => s + Number(x.price || 0) * Number(x.quantity || 0), 0);
  const productCost = sales.reduce((s, x) => s + Number(x.cost || 0) * Number(x.quantity || 0), 0);
  const expenses = periodExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const revenue = serviceRevenue + productRevenue;

  const barbersById = indexBarbersById(barbers);
  const commissionReport = buildCommissionReport(appointments, barbersById, { aggregateByBarber: false });
  const repasseServicos = commissionReport.totals.totalBarber;
  const retencaoCasaServicos = commissionReport.totals.totalHouse;
  const netProfit = revenue - repasseServicos - expenses - productCost;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const itemsCount = appointments.length + sales.length;

  return {
    startDate,
    endDate,
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

const getMonthClosings = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.json([]);
    }
    const rows = await prisma.monthClosing.findMany({
      where: tenantWhere(req),
      orderBy: { yearMonth: 'desc' },
    });
    res.json(rows);
  } catch (error) {
    console.error('getMonthClosings', error);
    res.status(500).json({ error: 'Erro ao listar fechamentos' });
  }
};

const createMonthClosing = async (req, res) => {
  if (req.user?.role === 'Barbeiro') {
    return res.status(403).json({ error: 'Apenas gestão pode registrar fechamento mensal.' });
  }

  const { yearMonth, notes } = req.body || {};
  if (!yearMonth || typeof yearMonth !== 'string' || !YEAR_MONTH_RE.test(yearMonth.trim())) {
    return res.status(400).json({ error: 'Informe yearMonth no formato YYYY-MM (ex.: 2026-05).' });
  }

  const ym = yearMonth.trim();
  let closedByName = null;
  try {
    const barber = await prisma.barber.findUnique({ where: { id: req.user.id } });
    closedByName = barber?.name || null;
  } catch (_) {
    /* ignore */
  }

  try {
    const tenantId = tenantIdFromReq(req);
    const snapshot = await buildSnapshotForMonth(tenantId, ym);
    const created = await prisma.monthClosing.create({
      data: {
        tenantId,
        yearMonth: ym,
        closedById: req.user.id,
        closedByName,
        snapshot,
        notes: notes && String(notes).trim() ? String(notes).trim().slice(0, 2000) : null,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Este mês já possui fechamento registrado.' });
    }
    console.error('createMonthClosing', error);
    res.status(500).json({ error: 'Erro ao registrar fechamento' });
  }
};

module.exports = {
  getMonthClosings,
  createMonthClosing,
};
