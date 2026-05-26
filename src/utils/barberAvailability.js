/** Data local YYYY-MM-DD */
export function getLocalDateIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Converte HH:mm para minutos desde meia-noite. */
export function timeToMinutes(hhmm) {
  const m = String(hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + min;
}

export function parseDurationMinutes(duration) {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) return duration;
  const m = String(duration ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 30;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Dia da semana 0=Dom … 6=Sáb (mesmo que Date.getDay). */
export function getDayOfWeekFromIso(dateIso) {
  return new Date(`${dateIso}T12:00:00`).getDay();
}

export function getActiveShiftsForWeekday(barber, dayOfWeek) {
  return (barber?.shifts || []).filter(
    (s) => Number(s.dia_semana) === dayOfWeek && s.ativo !== false && s.ativo !== 'false'
  );
}

/** Horário dentro do turno e fora do intervalo de almoço. */
export function isWithinShift(time, durationMinutes, shift) {
  const start = timeToMinutes(time);
  if (start == null) return false;
  const dur = parseDurationMinutes(durationMinutes);
  const end = start + dur;
  const shiftStart = timeToMinutes(shift.hora_inicio);
  const shiftEnd = timeToMinutes(shift.hora_fim);
  if (shiftStart == null || shiftEnd == null) return false;
  if (start < shiftStart || end > shiftEnd) return false;

  const lunchStart = timeToMinutes(shift.almoco_inicio);
  const lunchEnd = timeToMinutes(shift.almoco_fim);
  if (lunchStart != null && lunchEnd != null && lunchStart < lunchEnd) {
    if (rangesOverlap(start, end, lunchStart, lunchEnd)) return false;
  }
  return true;
}

/** Bloqueio por data: dia inteiro ou faixa horária. */
export function isBlockedByScheduleBlock(dateIso, time, durationMinutes, blocks) {
  if (!dateIso || !Array.isArray(blocks) || blocks.length === 0) return false;
  const start = timeToMinutes(time);
  if (start == null) return false;
  const end = start + parseDurationMinutes(durationMinutes);

  for (const b of blocks) {
    if (b.date !== dateIso) continue;
    const hasStart = b.startTime != null && String(b.startTime).trim() !== '';
    const hasEnd = b.endTime != null && String(b.endTime).trim() !== '';
    if (!hasStart && !hasEnd) return true;

    const bs = timeToMinutes(b.startTime);
    const be = timeToMinutes(b.endTime);
    if (bs != null && be != null && rangesOverlap(start, end, bs, be)) return true;
  }
  return false;
}

/**
 * Verifica se o barbeiro pode atender no horário (turno semanal + exceções por data).
 * Não verifica conflito com outros agendamentos — use bookingAvailability para isso.
 */
export function isBarberScheduleOpen({
  barber,
  dateIso,
  time,
  durationMinutes = 30,
  scheduleBlocks,
}) {
  if (!barber || barber.status === 'Suspenso') return false;
  const dayOfWeek = getDayOfWeekFromIso(dateIso);
  const shifts = getActiveShiftsForWeekday(barber, dayOfWeek);
  if (shifts.length === 0) return false;

  const blocks =
    scheduleBlocks !== undefined
      ? scheduleBlocks
      : barber.scheduleBlocks || [];

  if (isBlockedByScheduleBlock(dateIso, time, durationMinutes, blocks)) {
    return false;
  }

  return shifts.some((s) => isWithinShift(time, durationMinutes, s));
}

export function hasBarberWorkingDay(barber, dateIso, scheduleBlocks) {
  if (!barber?.shifts?.length) return false;
  const dayOfWeek = getDayOfWeekFromIso(dateIso);
  const shifts = getActiveShiftsForWeekday(barber, dayOfWeek);
  if (shifts.length === 0) return false;
  const blocks =
    scheduleBlocks !== undefined ? scheduleBlocks : barber.scheduleBlocks || [];
  const fullDayBlock = blocks.some(
    (b) =>
      b.date === dateIso &&
      (b.startTime == null || String(b.startTime).trim() === '') &&
      (b.endTime == null || String(b.endTime).trim() === '')
  );
  return !fullDayBlock;
}
