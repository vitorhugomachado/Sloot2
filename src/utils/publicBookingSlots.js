import { getTakenTimesForBarber } from './bookingAvailability';
import {
  getActiveShiftsForWeekday,
  getDayOfWeekFromIso,
  hasBarberWorkingDay,
  isBarberScheduleOpen,
  parseDurationMinutes,
} from './barberAvailability';

/** Slots base do agendamento público (HH:mm). */
export const PUBLIC_BOOKING_TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00',
];

/**
 * @param {object} params
 * @param {string} params.dateIso YYYY-MM-DD
 * @param {object|null} params.barber barbeiro com shifts e scheduleBlocks
 * @param {number|string} params.durationMinutes duração do serviço em minutos
 * @param {Array} params.appointments lista de agendamentos (AppContext)
 * @returns {{ slotsToDisplay: string[], isWithinAnyShift: (time: string) => boolean, taken: Set<string> }}
 */
export function getPublicBookingSlotsForDay({ dateIso, barber, durationMinutes, appointments }) {
  const dayOfWeek = getDayOfWeekFromIso(dateIso);
  const barberShifts = getActiveShiftsForWeekday(barber, dayOfWeek);
  const dur = parseDurationMinutes(durationMinutes);
  const blocks = barber?.scheduleBlocks || [];

  const isWithinAnyShift = (time) =>
    isBarberScheduleOpen({
      barber,
      dateIso,
      time,
      durationMinutes: dur,
      scheduleBlocks: blocks,
    });

  const baseFilteredSlots =
    dur > 30 ? PUBLIC_BOOKING_TIME_SLOTS.filter((t) => t.endsWith(':00')) : PUBLIC_BOOKING_TIME_SLOTS;

  let minStart = null;
  let maxEnd = null;
  barberShifts.forEach((s) => {
    if (!minStart || s.hora_inicio < minStart) minStart = s.hora_inicio;
    if (!maxEnd || s.hora_fim > maxEnd) maxEnd = s.hora_fim;
  });

  const slotsToDisplay =
    barberShifts.length === 0 || minStart == null || maxEnd == null
      ? []
      : baseFilteredSlots.filter((t) => t >= minStart && t < maxEnd);

  const taken = getTakenTimesForBarber(appointments || [], dateIso, barber?.id);

  return { slotsToDisplay, isWithinAnyShift, taken };
}

/** Indica se o barbeiro tem expediente neste dia (sem bloqueio de dia inteiro). */
export function hasBarberShiftOnDate(barber, dateIso) {
  return hasBarberWorkingDay(barber, dateIso);
}

/** União de horários disponíveis entre vários barbeiros (modo "Qualquer um"). */
export function getPublicBookingSlotsForDayAnyBarber({
  dateIso,
  barbers,
  durationMinutes,
  appointments,
}) {
  const available = new Set();
  const display = new Set();

  (barbers || []).forEach((barber) => {
    const { slotsToDisplay, isWithinAnyShift, taken } = getPublicBookingSlotsForDay({
      dateIso,
      barber,
      durationMinutes,
      appointments,
    });
    slotsToDisplay.forEach((t) => display.add(t));
    slotsToDisplay.forEach((t) => {
      if (isWithinAnyShift(t) && !taken.has(t)) available.add(t);
    });
  });

  const slotsToDisplay = [...display].sort();
  return {
    slotsToDisplay,
    isWithinAnyShift: (time) => available.has(time),
    taken: new Set(),
  };
}

/** Primeiro barbeiro que pode atender no horário (modo "Qualquer um"). */
export function resolveBarberForAnySlot({ dateIso, time, barbers, durationMinutes, appointments }) {
  for (const barber of barbers || []) {
    const { isWithinAnyShift, taken } = getPublicBookingSlotsForDay({
      dateIso,
      barber,
      durationMinutes,
      appointments,
    });
    if (isWithinAnyShift(time) && !taken.has(time)) return barber;
  }
  return null;
}
