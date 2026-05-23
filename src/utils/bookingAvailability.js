import { isBarberScheduleOpen, parseDurationMinutes } from './barberAvailability';

/** Estados que ocupam o horário (impedem novo agendamento no mesmo slot). */
export const BOOKING_BLOCKING_STATUSES = ['Agendado', 'Confirmado', 'Em progresso'];

/** Normaliza horário para HH:mm (comparação com slots da grade). */
export function normalizeBookingTime(time) {
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

/** Data local YYYY-MM-DD */
export function getLocalDateIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** true se o início do slot já passou (dia de hoje ou data anterior). */
export function isBookingSlotInPast(dateStr, timeStr, now = new Date()) {
  if (!dateStr) return false;
  const today = getLocalDateIso(now);
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  const slotMin = timeToMinutes(timeStr);
  if (slotMin == null) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return slotMin < nowMin;
}

/**
 * @param {Array<{ date: string, time: string, barberId: number|string, status: string }>} appointments
 * @param {string} dateStr YYYY-MM-DD
 * @param {string|number} barberId
 * @returns {Set<string>} horários HH:mm ocupados
 */
export function getTakenTimesForBarber(appointments, dateStr, barberId) {
  const taken = new Set();
  if (!dateStr || barberId === undefined || barberId === null || barberId === '') return taken;
  const b = String(barberId);
  for (const a of appointments) {
    if (a.date !== dateStr || String(a.barberId) !== b) continue;
    if (BOOKING_BLOCKING_STATUSES.includes(a.status)) {
      const t = normalizeBookingTime(a.time);
      if (t) taken.add(t);
    }
  }
  return taken;
}

/**
 * @param {object} [opts]
 * @param {object|null} [opts.barber] barbeiro com shifts e scheduleBlocks
 * @param {number} [opts.durationMinutes] duração do serviço para validar turno/almoco
 */
export function filterAvailableBookingTimes(
  timeSlotsAll,
  appointments,
  dateStr,
  barberId,
  opts = {}
) {
  if (!dateStr) return [...timeSlotsAll];
  if (barberId === undefined || barberId === null || barberId === '') return [...timeSlotsAll];
  const taken = getTakenTimesForBarber(appointments, dateStr, barberId);
  const { barber, durationMinutes } = opts;
  const dur = parseDurationMinutes(durationMinutes);

  return timeSlotsAll.filter((t) => {
    if (isBookingSlotInPast(dateStr, t)) return false;
    if (taken.has(t)) return false;
    if (!barber) return true;
    return isBarberScheduleOpen({
      barber,
      dateIso: dateStr,
      time: t,
      durationMinutes: dur,
    });
  });
}

export function isBookingSlotTaken(appointments, dateStr, timeStr, barberId) {
  if (!dateStr || !timeStr) return false;
  if (barberId === undefined || barberId === null || barberId === '') return false;
  const slot = normalizeBookingTime(timeStr);
  if (!slot) return false;
  return getTakenTimesForBarber(appointments, dateStr, barberId).has(slot);
}
