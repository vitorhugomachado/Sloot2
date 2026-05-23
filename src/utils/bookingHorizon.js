/** Alinhado com PublicBooking MAX_BOOKING_HORIZON_DAYS e server bookingHorizon.js */
export const PUBLIC_BOOKING_HORIZON_DAYS = 60;

/** Painel staff — GET /appointments */
export const STAFF_APPOINTMENTS_PAST_DAYS = 120;
export const STAFF_APPOINTMENTS_FUTURE_DAYS = 60;

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

export function getPublicBookingDateRange() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + PUBLIC_BOOKING_HORIZON_DAYS);
  return { from: fmt(from), to: fmt(to) };
}

export function getStaffAppointmentsDateRange() {
  const from = new Date();
  from.setDate(from.getDate() - STAFF_APPOINTMENTS_PAST_DAYS);
  const to = new Date();
  to.setDate(to.getDate() + STAFF_APPOINTMENTS_FUTURE_DAYS);
  return { from: fmt(from), to: fmt(to) };
}

export function getBootstrapQueryString() {
  const { from, to } = getPublicBookingDateRange();
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export function getStaffAppointmentsQueryString(from, to) {
  const range = from && to ? { from, to } : getStaffAppointmentsDateRange();
  return `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
}

export function staffAppointmentsUrl(apiBase) {
  return `${apiBase}/appointments?${getStaffAppointmentsQueryString()}`;
}
