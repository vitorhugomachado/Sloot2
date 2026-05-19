/** Converte HH:mm para minutos desde meia-noite. */
function timeToMinutes(hhmm) {
  const m = String(hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + min;
}

function parseDurationMinutes(duration) {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) return duration;
  const m = String(duration ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 30;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function getDayOfWeekFromIso(dateIso) {
  return new Date(`${dateIso}T12:00:00`).getDay();
}

function getActiveShiftsForWeekday(barber, dayOfWeek) {
  return (barber?.shifts || []).filter(
    (s) => Number(s.dia_semana) === dayOfWeek && s.ativo !== false && s.ativo !== 'false'
  );
}

function isWithinShift(time, durationMinutes, shift) {
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

function isBlockedByScheduleBlock(dateIso, time, durationMinutes, blocks) {
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

function isBarberScheduleOpen({ barber, dateIso, time, durationMinutes = 30, scheduleBlocks }) {
  if (!barber || barber.status === 'Suspenso') return false;
  const dayOfWeek = getDayOfWeekFromIso(dateIso);
  const shifts = getActiveShiftsForWeekday(barber, dayOfWeek);
  if (shifts.length === 0) return false;

  const blocks =
    scheduleBlocks !== undefined ? scheduleBlocks : barber.scheduleBlocks || [];

  if (isBlockedByScheduleBlock(dateIso, time, durationMinutes, blocks)) {
    return false;
  }

  return shifts.some((s) => isWithinShift(time, durationMinutes, s));
}

function validateBarberAppointmentSlot({ barber, dateIso, time, durationMinutes, scheduleBlocks }) {
  if (!isBarberScheduleOpen({ barber, dateIso, time, durationMinutes, scheduleBlocks })) {
    return {
      ok: false,
      message: 'O profissional não atende neste dia ou horário (carga horária ou horário fechado).',
    };
  }
  return { ok: true };
}

module.exports = {
  timeToMinutes,
  parseDurationMinutes,
  isBarberScheduleOpen,
  validateBarberAppointmentSlot,
};
