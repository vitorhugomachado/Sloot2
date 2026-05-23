/** Normaliza horário para HH:mm (grade e conflitos de slot). */
function normalizeBookingTime(time) {
  const m = String(time ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function timeToMinutes(hhmm) {
  const slot = normalizeBookingTime(hhmm);
  if (!slot) return null;
  const [h, m] = slot.split(':').map(Number);
  return h * 60 + m;
}

function getLocalDateIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isBookingSlotInPast(dateIso, time, now = new Date()) {
  if (!dateIso) return false;
  const today = getLocalDateIso(now);
  if (dateIso < today) return true;
  if (dateIso > today) return false;
  const slotMin = timeToMinutes(time);
  if (slotMin == null) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return slotMin < nowMin;
}

module.exports = { normalizeBookingTime, isBookingSlotInPast };
