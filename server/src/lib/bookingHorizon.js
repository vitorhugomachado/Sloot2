const { getLocalDateIso, addDaysToDateIso } = require('../utils/appointmentTime');

/** Alinhado com MAX_BOOKING_HORIZON_DAYS no PublicBooking.jsx */
const PUBLIC_BOOKING_HORIZON_DAYS = 60;

/** Painel staff — GET /appointments (evita carregar histórico inteiro) */
const STAFF_APPOINTMENTS_PAST_DAYS = 120;
const STAFF_APPOINTMENTS_FUTURE_DAYS = 60;
const MAX_STAFF_APPOINTMENTS_RANGE_DAYS = 366;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateRangeFromQuery(query = {}) {
  const defaults = publicBookingDateRange();
  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();
  if (DATE_RE.test(from) && DATE_RE.test(to) && from <= to) {
    return { from, to };
  }
  return defaults;
}

function publicBookingDateRange() {
  const from = getLocalDateIso();
  const to = addDaysToDateIso(from, PUBLIC_BOOKING_HORIZON_DAYS);
  return { from, to };
}

function staffAppointmentDateRange() {
  const today = getLocalDateIso();
  const from = addDaysToDateIso(today, -STAFF_APPOINTMENTS_PAST_DAYS);
  const to = addDaysToDateIso(today, STAFF_APPOINTMENTS_FUTURE_DAYS);
  return { from, to };
}

function parseStaffDateRangeFromQuery(query = {}) {
  const defaults = staffAppointmentDateRange();
  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();
  if (DATE_RE.test(from) && DATE_RE.test(to) && from <= to) {
    const fromD = new Date(`${from}T12:00:00`);
    const toD = new Date(`${to}T12:00:00`);
    const spanDays = (toD.getTime() - fromD.getTime()) / 86400000;
    if (spanDays >= 0 && spanDays <= MAX_STAFF_APPOINTMENTS_RANGE_DAYS) {
      return { from, to };
    }
  }
  return defaults;
}

module.exports = {
  PUBLIC_BOOKING_HORIZON_DAYS,
  STAFF_APPOINTMENTS_PAST_DAYS,
  STAFF_APPOINTMENTS_FUTURE_DAYS,
  publicBookingDateRange,
  staffAppointmentDateRange,
  parseDateRangeFromQuery,
  parseStaffDateRangeFromQuery,
};
