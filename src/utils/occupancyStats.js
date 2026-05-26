import { normalizeBookingTime } from './bookingAvailability';
import {
  getDayOfWeekFromIso,
  getLocalDateIso,
  isBarberScheduleOpen,
  parseDurationMinutes,
} from './barberAvailability';
import { PUBLIC_BOOKING_TIME_SLOTS } from './publicBookingSlots';

function enumerateDates(startIso, endIso) {
  const dates = [];
  const cursor = new Date(`${startIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function slotMinutes(hhmm) {
  const m = String(hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function isSlotInPast(dateIso, timeStr, todayIso, now = new Date()) {
  if (dateIso < todayIso) return false;
  if (dateIso > todayIso) return false;
  const slotMin = slotMinutes(timeStr);
  if (slotMin == null) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return slotMin < nowMin;
}

/**
 * Slots válidos no turno do barbeiro (sem excluir horários já reservados).
 */
export function getShiftCapacitySlotsForDay(barber, dateIso, durationMinutes = 30, now = new Date()) {
  if (!barber || barber.status === 'Suspenso') return [];
  const todayIso = getLocalDateIso(now);
  const dur = parseDurationMinutes(durationMinutes);
  const dayOfWeek = getDayOfWeekFromIso(dateIso);

  if (!(barber.shifts || []).some((s) => Number(s.dia_semana) === dayOfWeek && s.ativo !== false && s.ativo !== 'false')) {
    return [];
  }

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

/**
 * Ocupação = agendamentos não cancelados / slots disponíveis nos turnos reais.
 */
export function computeOccupancyForPeriod({
  startDate,
  endDate,
  barbers,
  appointments,
  durationMinutes = 30,
  now = new Date(),
}) {
  if (!startDate || !endDate || !barbers?.length) {
    return { rate: 0, occupied: 0, capacity: 0 };
  }

  const dates = enumerateDates(startDate, endDate);
  let capacity = 0;
  let occupied = 0;

  for (const dateIso of dates) {
    for (const barber of barbers) {
      const shiftSlots = getShiftCapacitySlotsForDay(barber, dateIso, durationMinutes, now);
      capacity += shiftSlots.length;

      const dayApps = (appointments || []).filter(
        (a) =>
          a.date === dateIso &&
          String(a.barberId) === String(barber.id) &&
          a.status !== 'Cancelado' &&
          normalizeBookingTime(a.time)
      );
      occupied += dayApps.length;
    }
  }

  const rate = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  return { rate, occupied, capacity };
}
