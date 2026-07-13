import { describe, expect, it } from 'vitest';
import {
  getDayOfWeekFromIso,
  hasBarberWorkingDay,
  isBarberScheduleOpen,
  isWithinShift,
  parseDurationMinutes,
} from './barberAvailability';
import { activeSundayBarber, blockedDayBarber, SUNDAY, suspendedBarber } from './__fixtures__/barbers';

describe('parseDurationMinutes', () => {
  it('interpreta número e string com minutos', () => {
    expect(parseDurationMinutes(45)).toBe(45);
    expect(parseDurationMinutes('60 min')).toBe(60);
    expect(parseDurationMinutes(undefined)).toBe(30);
  });
});

describe('getDayOfWeekFromIso', () => {
  it('retorna domingo para 2026-07-12', () => {
    expect(getDayOfWeekFromIso(SUNDAY)).toBe(0);
  });
});

describe('isWithinShift', () => {
  const shift = activeSundayBarber.shifts[0];

  it('aceita horário dentro do turno', () => {
    expect(isWithinShift('09:00', 30, shift)).toBe(true);
  });

  it('rejeita horário durante o almoço', () => {
    expect(isWithinShift('11:00', 30, shift)).toBe(false);
  });

  it('rejeita horário após o fim do turno', () => {
    expect(isWithinShift('11:45', 30, shift)).toBe(false);
  });
});

describe('isBarberScheduleOpen', () => {
  it('retorna false para barbeiro suspenso', () => {
    expect(
      isBarberScheduleOpen({
        barber: suspendedBarber,
        dateIso: SUNDAY,
        time: '09:00',
      })
    ).toBe(false);
  });

  it('retorna false com bloqueio de dia inteiro', () => {
    expect(
      isBarberScheduleOpen({
        barber: blockedDayBarber,
        dateIso: SUNDAY,
        time: '09:00',
        scheduleBlocks: blockedDayBarber.scheduleBlocks,
      })
    ).toBe(false);
  });

  it('retorna true em horário válido do turno', () => {
    expect(
      isBarberScheduleOpen({
        barber: activeSundayBarber,
        dateIso: SUNDAY,
        time: '09:00',
      })
    ).toBe(true);
  });
});

describe('hasBarberWorkingDay', () => {
  it('retorna false quando há bloqueio de dia inteiro', () => {
    expect(hasBarberWorkingDay(blockedDayBarber, SUNDAY, blockedDayBarber.scheduleBlocks)).toBe(false);
  });

  it('retorna true em dia com turno ativo', () => {
    expect(hasBarberWorkingDay(activeSundayBarber, SUNDAY)).toBe(true);
  });
});
