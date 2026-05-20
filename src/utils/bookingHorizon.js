/** Alinhado com PublicBooking MAX_BOOKING_HORIZON_DAYS e server bookingHorizon.js */
export const PUBLIC_BOOKING_HORIZON_DAYS = 60;

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

export function getPublicBookingDateRange() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + PUBLIC_BOOKING_HORIZON_DAYS);
  return { from: fmt(from), to: fmt(to) };
}

export function getBootstrapQueryString() {
  const { from, to } = getPublicBookingDateRange();
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}
