const SERVICE_BOOKING_ICONS = Object.freeze([
  'cut',
  'beard',
  'combo',
  'razor',
  'color',
  'eyebrow',
  'generic',
]);

const SERVICE_BOOKING_ICON_SET = new Set(SERVICE_BOOKING_ICONS);

function normalizeServiceBookingIcon(value, fallback = 'generic') {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return SERVICE_BOOKING_ICON_SET.has(normalized) ? normalized : null;
}

module.exports = { SERVICE_BOOKING_ICONS, normalizeServiceBookingIcon };
