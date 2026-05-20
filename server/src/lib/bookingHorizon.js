/** Alinhado com MAX_BOOKING_HORIZON_DAYS no PublicBooking.jsx */
const PUBLIC_BOOKING_HORIZON_DAYS = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

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
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + PUBLIC_BOOKING_HORIZON_DAYS);
  return { from: fmtDate(from), to: fmtDate(to) };
}

module.exports = {
  PUBLIC_BOOKING_HORIZON_DAYS,
  publicBookingDateRange,
  parseDateRangeFromQuery,
};
