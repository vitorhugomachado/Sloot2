const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

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

function getZonedDateParts(now = new Date(), timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
}

/** Data YYYY-MM-DD no fuso da aplicação (padrão America/Sao_Paulo). */
function getLocalDateIso(now = new Date(), timeZone = APP_TIMEZONE) {
  const p = getZonedDateParts(now, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

function isBookingSlotInPast(dateIso, time, now = new Date(), timeZone = APP_TIMEZONE) {
  if (!dateIso) return false;
  const today = getLocalDateIso(now, timeZone);
  if (dateIso < today) return true;
  if (dateIso > today) return false;
  const slotMin = timeToMinutes(time);
  if (slotMin == null) return true;
  const p = getZonedDateParts(now, timeZone);
  const nowMin = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
  return slotMin < nowMin;
}

/** Soma dias a uma data YYYY-MM-DD (aritmética de calendário, sem fuso). */
function addDaysToDateIso(dateIso, days) {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

module.exports = {
  APP_TIMEZONE,
  normalizeBookingTime,
  getLocalDateIso,
  isBookingSlotInPast,
  addDaysToDateIso,
};
