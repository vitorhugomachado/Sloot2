import { describe, expect, it } from 'vitest';
import {
  PUBLIC_BOOKING_HORIZON_DAYS,
  parseDateRangeFromQuery,
  parseStaffDateRangeFromQuery,
  publicBookingDateRange,
  staffAppointmentDateRange,
} from './bookingHorizon';

describe('parseDateRangeFromQuery', () => {
  it('aceita from e to válidos', () => {
    expect(parseDateRangeFromQuery({ from: '2026-07-01', to: '2026-07-31' })).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('rejeita intervalo invertido e usa default', () => {
    const defaults = publicBookingDateRange();
    expect(parseDateRangeFromQuery({ from: '2026-08-01', to: '2026-07-01' })).toEqual(defaults);
  });

  it('usa default de 60 dias para query inválida', () => {
    const result = parseDateRangeFromQuery({ from: 'invalid', to: '2026-07-01' });
    const defaults = publicBookingDateRange();
    expect(result).toEqual(defaults);
    expect(result.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('publicBookingDateRange', () => {
  it('define horizonte público de 60 dias', () => {
    const { from, to } = publicBookingDateRange();
    const fromDate = new Date(`${from}T12:00:00`);
    const toDate = new Date(`${to}T12:00:00`);
    const spanDays = (toDate.getTime() - fromDate.getTime()) / 86400000;
    expect(spanDays).toBe(PUBLIC_BOOKING_HORIZON_DAYS);
  });
});

describe('parseStaffDateRangeFromQuery', () => {
  it('aceita intervalo válido dentro do limite', () => {
    expect(parseStaffDateRangeFromQuery({ from: '2026-01-01', to: '2026-06-01' })).toEqual({
      from: '2026-01-01',
      to: '2026-06-01',
    });
  });

  it('rejeita intervalo maior que 366 dias', () => {
    const defaults = staffAppointmentDateRange();
    expect(
      parseStaffDateRangeFromQuery({ from: '2024-01-01', to: '2026-12-31' })
    ).toEqual(defaults);
  });

  it('usa default staff para query inválida', () => {
    const result = parseStaffDateRangeFromQuery({ from: 'bad', to: '2026-07-01' });
    expect(result).toEqual(staffAppointmentDateRange());
  });
});
