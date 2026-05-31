const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizePayments(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return null;
}

/**
 * Data em que o atendimento entrou no faturamento (pagamento / finalização).
 * Fallback: data do agendamento (registros antigos).
 */
export function getAppointmentRevenueDate(app) {
  const payments = normalizePayments(app?.payments);
  if (payments && typeof payments === 'object' && !Array.isArray(payments)) {
    const paidAt = String(payments.paidAt || '').slice(0, 10);
    if (DATE_RE.test(paidAt)) return paidAt;
  }
  const scheduled = String(app?.date || '').slice(0, 10);
  return DATE_RE.test(scheduled) ? scheduled : '';
}

/** Valor do serviço (sem produtos — estes vão em productSales). */
export function getAppointmentServiceRevenue(app) {
  const payments = normalizePayments(app?.payments);
  if (payments && typeof payments === 'object' && !Array.isArray(payments)) {
    const serviceTotal = Number(payments.serviceTotal);
    if (Number.isFinite(serviceTotal) && serviceTotal >= 0) return serviceTotal;
  }
  const price = Number(app?.price);
  return Number.isFinite(price) ? price : 0;
}

export function isAppointmentInRevenuePeriod(app, startDate, endDate) {
  const d = getAppointmentRevenueDate(app);
  if (!d) return false;
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
}
