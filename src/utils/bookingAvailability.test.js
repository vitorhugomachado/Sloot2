import { describe, expect, it, vi } from 'vitest';
import {
  appointmentOccupiesSlot,
  filterAvailableBookingTimes,
  isBookingSlotInPast,
  isBookingSlotTaken,
  normalizeBookingTime,
} from './bookingAvailability';

const FIXED_NOW = new Date('2026-07-12T10:00:00');
const FUTURE_DATE = '2026-07-15';
const BARBER_ID = 1;

const baseAppointments = [
  {
    id: 1,
    date: FUTURE_DATE,
    time: '10:00',
    barberId: BARBER_ID,
    status: 'Agendado',
    service: 'Corte',
    durationMinutes: 30,
  },
];

describe('normalizeBookingTime', () => {
  it('normaliza horário sem zero à esquerda na hora', () => {
    expect(normalizeBookingTime('9:00')).toBe('09:00');
  });

  it('retorna null para entrada inválida', () => {
    expect(normalizeBookingTime('invalid')).toBeNull();
  });
});

describe('isBookingSlotInPast', () => {
  it('retorna true para data anterior', () => {
    expect(isBookingSlotInPast('2026-07-11', '14:00', FIXED_NOW)).toBe(true);
  });

  it('retorna true para horário anterior no mesmo dia', () => {
    expect(isBookingSlotInPast('2026-07-12', '09:00', FIXED_NOW)).toBe(true);
  });

  it('retorna false para horário futuro no mesmo dia', () => {
    expect(isBookingSlotInPast('2026-07-12', '11:00', FIXED_NOW)).toBe(false);
  });

  it('retorna false para data futura', () => {
    expect(isBookingSlotInPast(FUTURE_DATE, '09:00', FIXED_NOW)).toBe(false);
  });
});

describe('isBookingSlotTaken', () => {
  it('detecta conflito com agendamento ativo', () => {
    expect(
      isBookingSlotTaken(baseAppointments, FUTURE_DATE, '10:00', BARBER_ID, {
        durationMinutes: 30,
      })
    ).toBe(true);
  });

  it('ignora agendamento cancelado', () => {
    const appointments = [
      { ...baseAppointments[0], status: 'Cancelado' },
    ];
    expect(
      isBookingSlotTaken(appointments, FUTURE_DATE, '10:00', BARBER_ID, {
        durationMinutes: 30,
      })
    ).toBe(false);
  });

  it('detecta sobreposição por duração do serviço', () => {
    const appointments = [
      { ...baseAppointments[0], durationMinutes: 60 },
    ];
    expect(
      isBookingSlotTaken(appointments, FUTURE_DATE, '10:30', BARBER_ID, {
        durationMinutes: 30,
      })
    ).toBe(true);
  });
});

describe('appointmentOccupiesSlot', () => {
  it('marca slots dentro do intervalo do agendamento', () => {
    const app = baseAppointments[0];
    expect(appointmentOccupiesSlot(app, '10:00')).toBe(true);
    expect(appointmentOccupiesSlot(app, '10:30')).toBe(false);
  });
});

describe('filterAvailableBookingTimes', () => {
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00'];

  it('exclui horários ocupados', () => {
    const available = filterAvailableBookingTimes(
      slots,
      baseAppointments,
      FUTURE_DATE,
      BARBER_ID,
      { durationMinutes: 30 }
    );
    expect(available).not.toContain('10:00');
    expect(available).toContain('09:00');
    expect(available).toContain('11:00');
  });

  it('exclui horários no passado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    try {
      const available = filterAvailableBookingTimes(
        slots,
        [],
        '2026-07-12',
        BARBER_ID,
        { durationMinutes: 30 }
      );
      expect(available).not.toContain('09:00');
      expect(available).not.toContain('09:30');
      expect(available).toContain('11:00');
    } finally {
      vi.useRealTimers();
    }
  });
});
