import { describe, expect, it } from 'vitest';
import {
  getAppointmentRevenueDate,
  getAppointmentServiceRevenue,
  isAppointmentInRevenuePeriod,
} from './appointmentRevenue';

describe('getAppointmentRevenueDate', () => {
  it('usa paidAt quando presente em payments', () => {
    const app = {
      date: '2026-07-01',
      payments: { paidAt: '2026-07-05T14:30:00.000Z' },
    };
    expect(getAppointmentRevenueDate(app)).toBe('2026-07-05');
  });

  it('faz fallback para data do agendamento', () => {
    expect(getAppointmentRevenueDate({ date: '2026-07-12' })).toBe('2026-07-12');
  });

  it('retorna vazio para data inválida', () => {
    expect(getAppointmentRevenueDate({ date: 'invalid' })).toBe('');
  });
});

describe('getAppointmentServiceRevenue', () => {
  it('usa serviceTotal de payments quando disponível', () => {
    const app = { price: 50, payments: { serviceTotal: 75 } };
    expect(getAppointmentServiceRevenue(app)).toBe(75);
  });

  it('faz fallback para price', () => {
    expect(getAppointmentServiceRevenue({ price: 40 })).toBe(40);
  });
});

describe('isAppointmentInRevenuePeriod', () => {
  const app = {
    date: '2026-07-10',
    payments: { paidAt: '2026-07-12' },
  };

  it('inclui agendamento dentro do período', () => {
    expect(isAppointmentInRevenuePeriod(app, '2026-07-01', '2026-07-15')).toBe(true);
  });

  it('exclui agendamento fora do período', () => {
    expect(isAppointmentInRevenuePeriod(app, '2026-07-01', '2026-07-11')).toBe(false);
  });
});
