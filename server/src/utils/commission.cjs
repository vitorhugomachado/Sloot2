/**
 * Commission helpers (CommonJS) — mirror of src/utils/commission.js
 * Barber.commission = % retained by the shop on each service (0–100, default 50).
 */

const DEFAULT_SHOP_PCT = 50;

function getShopPercent(barber) {
  if (barber == null) return DEFAULT_SHOP_PCT;
  const n = Number(barber.commission);
  if (!Number.isFinite(n)) return DEFAULT_SHOP_PCT;
  return Math.max(0, Math.min(100, n));
}

function splitAppointmentCommission(price, shopPct) {
  const p = Number(price);
  const gross = Number.isFinite(p) ? p : 0;
  const pct = Number(shopPct);
  const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : DEFAULT_SHOP_PCT;
  const house = gross * (safePct / 100);
  const barber = gross - house;
  return { house, barber };
}

function indexBarbersById(barbers) {
  const map = {};
  for (const b of barbers || []) {
    if (b && b.id != null) map[Number(b.id)] = b;
  }
  return map;
}

function resolveBarberRecord(appointment, barbersById) {
  const id = Number(appointment?.barberId);
  const fromMap = barbersById?.[id];
  if (fromMap) return { barber: fromMap, usedDefaultCommission: false };
  return { barber: null, usedDefaultCommission: true };
}

function resolveBarberName(appointment, barber) {
  if (barber?.name) return barber.name;
  const rel = appointment?.Barber || appointment?.barber;
  if (rel?.name) return rel.name;
  return '—';
}

function buildCommissionReport(appointments, barbersById, options = {}) {
  const { aggregateByBarber = true, filterBarberId = null } = options;

  let list = Array.isArray(appointments) ? [...appointments] : [];
  if (filterBarberId != null && filterBarberId !== '' && filterBarberId !== 'all') {
    const fid = Number(filterBarberId);
    list = list.filter((a) => Number(a.barberId) === fid);
  }

  const rows = [];
  let totalService = 0;
  let totalHouse = 0;
  let totalBarber = 0;

  const byBarberMap = new Map();

  for (const app of list) {
    const barberId = Number(app.barberId);
    const { barber } = resolveBarberRecord(app, barbersById);
    const shopPct = getShopPercent(barber);
    const price = Number(app.price);
    const gross = Number.isFinite(price) ? price : 0;
    const { house, barber: barberShare } = splitAppointmentCommission(gross, shopPct);
    const barberName = resolveBarberName(app, barber);

    totalService += gross;
    totalHouse += house;
    totalBarber += barberShare;

    rows.push({
      appointmentId: app.id,
      date: app.date,
      time: app.time,
      customer: app.customer,
      service: app.service,
      barberId,
      barberName,
      price: gross,
      shopPct,
      house,
      barberPayout: barberShare,
    });

    if (aggregateByBarber) {
      const prev = byBarberMap.get(barberId) || {
        barberId,
        barberName,
        totalService: 0,
        totalHouse: 0,
        totalBarber: 0,
        count: 0,
      };
      prev.barberName = barberName;
      prev.totalService += gross;
      prev.totalHouse += house;
      prev.totalBarber += barberShare;
      prev.count += 1;
      byBarberMap.set(barberId, prev);
    }
  }

  rows.sort((a, b) => {
    const d = String(b.date).localeCompare(String(a.date));
    if (d !== 0) return d;
    return String(b.time || '').localeCompare(String(a.time || ''));
  });

  const byBarber = aggregateByBarber
    ? Array.from(byBarberMap.values()).sort((a, b) => b.totalService - a.totalService)
    : [];

  return {
    rows,
    totals: {
      totalService,
      totalHouse,
      totalBarber,
      count: rows.length,
    },
    byBarber,
  };
}

module.exports = {
  getShopPercent,
  splitAppointmentCommission,
  indexBarbersById,
  buildCommissionReport,
};
