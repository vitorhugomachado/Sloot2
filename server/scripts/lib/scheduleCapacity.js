/**
 * Capacidade de slots por dia (mesma lógica do dashboard / ocupação no front).
 */
const { isBarberScheduleOpen, parseDurationMinutes } = require('../../src/utils/barberAvailability');

const PUBLIC_BOOKING_TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00',
];

function normalizeBookingTime(time) {
  const m = String(time ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function slotMinutes(hhmm) {
  const t = normalizeBookingTime(hhmm);
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function isSlotInPast(dateIso, timeStr, todayIso, now = new Date()) {
  if (dateIso < todayIso) return false;
  if (dateIso > todayIso) return false;
  const slotMin = slotMinutes(timeStr);
  if (slotMin == null) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return slotMin < nowMin;
}

function getLocalDateIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Slots válidos no turno do barbeiro (grade pública, 30 min).
 */
function getShiftCapacitySlotsForDay(barber, dateIso, durationMinutes = 30, now = new Date()) {
  if (!barber || barber.status === 'Suspenso') return [];
  const todayIso = getLocalDateIso(now);
  const dur = parseDurationMinutes(durationMinutes);

  return PUBLIC_BOOKING_TIME_SLOTS.filter((time) => {
    if (isSlotInPast(dateIso, time, todayIso, now)) return false;
    return isBarberScheduleOpen({
      barber,
      dateIso,
      time,
      durationMinutes: dur,
    });
  });
}

module.exports = {
  PUBLIC_BOOKING_TIME_SLOTS,
  normalizeBookingTime,
  getShiftCapacitySlotsForDay,
};
