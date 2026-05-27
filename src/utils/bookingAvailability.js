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

function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
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
 * Duração em minutos de um agendamento (serviço cadastrado ou fallback 30).
 * @param {object} app
 * @param {Array<{ name: string, duration?: string|number }>} [services]
 */
export function getAppointmentDurationMinutes(app, services = []) {
  if (app?.durationMinutes != null) {
    return parseDurationMinutes(app.durationMinutes);
  }
  const svc = services.find((s) => s.name === app?.service);
  return parseDurationMinutes(svc?.duration ?? 30);
}

/**
 * Intervalo [início, fim) em minutos para um agendamento bloqueante.
 * @returns {{ start: number, end: number } | null}
 */
export function getAppointmentInterval(app, services = []) {
  if (!app || !BOOKING_BLOCKING_STATUSES.includes(app.status)) return null;
  const start = timeToMinutes(app.time);
  if (start == null) return null;
  const dur = getAppointmentDurationMinutes(app, services);
  return { start, end: start + dur };
}

/**
 * true se o slot (início HH:mm) está dentro do intervalo ocupado pelo agendamento.
 */
export function appointmentOccupiesSlot(app, slotTime, services = []) {
  const interval = getAppointmentInterval(app, services);
  const slot = timeToMinutes(slotTime);
  if (!interval || slot == null) return false;
  return slot >= interval.start && slot < interval.end;
}

/**
 * @param {Array<{ date: string, time: string, barberId: number|string, status: string }>} appointments
 * @param {string} dateStr YYYY-MM-DD
 * @param {string|number} barberId
 * @param {Array} [services]
 * @param {number} [slotStepMinutes]
 * @returns {Set<string>} horários HH:mm ocupados (todos os slots no intervalo)
 */
export function getTakenTimesForBarber(
  appointments,
  dateStr,
  barberId,
  services = [],
  slotStepMinutes = 30
) {
  const taken = new Set();
  if (!dateStr || barberId === undefined || barberId === null || barberId === '') return taken;
  const b = String(barberId);
  const step = Math.max(1, Number(slotStepMinutes) || 30);

  for (const a of appointments) {
    if (a.date !== dateStr || String(a.barberId) !== b) continue;
    if (!BOOKING_BLOCKING_STATUSES.includes(a.status)) continue;
    const interval = getAppointmentInterval(a, services);
    if (!interval) continue;
    for (let m = interval.start; m < interval.end; m += step) {
      const t = minutesToTime(m);
      if (t) taken.add(t);
    }
  }
  return taken;
}

/**
 * Verifica se um novo agendamento [time, time+duration) conflita com existentes.
 */
export function isBookingIntervalFree(
  appointments,
  dateStr,
  timeStr,
  barberId,
  opts = {}
) {
  if (!dateStr || !timeStr) return false;
  if (barberId === undefined || barberId === null || barberId === '') return false;
  const slot = normalizeBookingTime(timeStr);
  if (!slot) return false;
  const start = timeToMinutes(slot);
  if (start == null) return false;
  const dur = parseDurationMinutes(opts.durationMinutes ?? 30);
  const end = start + dur;
  const b = String(barberId);
  const services = opts.services || [];

  for (const a of appointments) {
    if (a.date !== dateStr || String(a.barberId) !== b) continue;
    if (!BOOKING_BLOCKING_STATUSES.includes(a.status)) continue;
    const interval = getAppointmentInterval(a, services);
    if (!interval) continue;
    if (rangesOverlap(start, end, interval.start, interval.end)) return false;
  }
  return true;
}

/**
 * @param {object} [opts]
 * @param {object|null} [opts.barber] barbeiro com shifts e scheduleBlocks
 * @param {number} [opts.durationMinutes] duração do serviço para validar turno/almoco
 * @param {Array} [opts.services] lista de serviços para cálculo de ocupação
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
  const { barber, durationMinutes, services } = opts;
  const dur = parseDurationMinutes(durationMinutes);

  return timeSlotsAll.filter((t) => {
    if (isBookingSlotInPast(dateStr, t)) return false;
    if (!isBookingIntervalFree(appointments, dateStr, t, barberId, { durationMinutes: dur, services })) {
      return false;
    }
    if (!barber) return true;
    return isBarberScheduleOpen({
      barber,
      dateIso: dateStr,
      time: t,
      durationMinutes: dur,
    });
  });
}

export function isBookingSlotTaken(appointments, dateStr, timeStr, barberId, opts = {}) {
  if (!dateStr || !timeStr) return false;
  if (barberId === undefined || barberId === null || barberId === '') return false;
  const slot = normalizeBookingTime(timeStr);
  if (!slot) return false;
  return !isBookingIntervalFree(appointments, dateStr, slot, barberId, opts);
}
