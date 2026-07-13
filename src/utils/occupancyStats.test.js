import { describe, expect, it } from 'vitest';
import { computeOccupancyForPeriod, getShiftCapacitySlotsForDay } from './occupancyStats';

const FIXED_NOW = new Date('2026-07-12T08:00:00');
const SUNDAY = '2026-07-12';
const MONDAY = '2026-07-13';

const sundayShiftBarber = {
  id: 1,
  status: 'Ativo',
  shifts: [
    {
      dia_semana: 0,
      ativo: true,
      hora_inicio: '09:00',
      hora_fim: '12:00',
      almoco_inicio: null,
      almoco_fim: null,
    },
  ],
  scheduleBlocks: [],
};

const suspendedBarber = {
  id: 2,
  status: 'Suspenso',
  shifts: sundayShiftBarber.shifts,
  scheduleBlocks: [],
};

describe('getShiftCapacitySlotsForDay', () => {
  it('retorna vazio para barbeiro suspenso', () => {
    expect(getShiftCapacitySlotsForDay(suspendedBarber, SUNDAY, 30, FIXED_NOW)).toEqual([]);
  });

  it('retorna vazio quando não há turno no dia', () => {
    expect(getShiftCapacitySlotsForDay(sundayShiftBarber, MONDAY, 30, FIXED_NOW)).toEqual([]);
  });

  it('lista slots dentro do turno', () => {
    const slots = getShiftCapacitySlotsForDay(sundayShiftBarber, SUNDAY, 30, FIXED_NOW);
    expect(slots).toContain('09:00');
    expect(slots).toContain('11:30');
    expect(slots).not.toContain('12:00');
  });
});

describe('computeOccupancyForPeriod', () => {
  it('retorna zero sem barbeiros', () => {
    expect(
      computeOccupancyForPeriod({
        startDate: SUNDAY,
        endDate: SUNDAY,
        barbers: [],
        appointments: [],
        now: FIXED_NOW,
      })
    ).toEqual({ rate: 0, occupied: 0, capacity: 0 });
  });

  it('calcula taxa de ocupação no período', () => {
    const result = computeOccupancyForPeriod({
      startDate: SUNDAY,
      endDate: SUNDAY,
      barbers: [sundayShiftBarber],
      appointments: [
        {
          id: 1,
          date: SUNDAY,
          time: '10:00',
          barberId: 1,
          status: 'Agendado',
        },
      ],
      now: FIXED_NOW,
    });

    expect(result.capacity).toBeGreaterThan(0);
    expect(result.occupied).toBe(1);
    expect(result.rate).toBe(Math.min(100, Math.round((1 / result.capacity) * 100)));
  });

  it('não conta capacidade de barbeiro suspenso', () => {
    const result = computeOccupancyForPeriod({
      startDate: SUNDAY,
      endDate: SUNDAY,
      barbers: [suspendedBarber],
      appointments: [],
      now: FIXED_NOW,
    });

    expect(result).toEqual({ rate: 0, occupied: 0, capacity: 0 });
  });
});
