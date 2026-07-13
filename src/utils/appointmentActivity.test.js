import { describe, expect, it } from 'vitest';
import {
  appointmentHasActivityChange,
  mergeAppointmentActivity,
  mergeAppointmentsWithActivity,
} from './appointmentActivity';

const baseApp = {
  id: 1,
  status: 'Agendado',
  service: 'Corte',
  price: 50,
  time: '10:00',
  date: '2026-07-12',
  payments: null,
};

describe('appointmentHasActivityChange', () => {
  it('retorna true sem app anterior', () => {
    expect(appointmentHasActivityChange(null, baseApp)).toBe(true);
  });

  it('detecta mudança de status', () => {
    expect(appointmentHasActivityChange(baseApp, { ...baseApp, status: 'Confirmado' })).toBe(true);
  });

  it('ignora quando nada relevante mudou', () => {
    expect(appointmentHasActivityChange(baseApp, { ...baseApp })).toBe(false);
  });

  it('detecta mudança em payments', () => {
    expect(
      appointmentHasActivityChange(baseApp, {
        ...baseApp,
        payments: { serviceTotal: 50 },
      })
    ).toBe(true);
  });
});

describe('mergeAppointmentActivity', () => {
  const now = 1_700_000_000_000;

  it('define _updatedAtLocal em registro novo', () => {
    expect(mergeAppointmentActivity(null, baseApp, now)._updatedAtLocal).toBe(now);
  });

  it('preserva _updatedAtLocal quando não houve mudança', () => {
    const old = { ...baseApp, _updatedAtLocal: 100 };
    expect(mergeAppointmentActivity(old, baseApp, now)._updatedAtLocal).toBe(100);
  });

  it('atualiza _updatedAtLocal quando houve mudança', () => {
    const old = { ...baseApp, _updatedAtLocal: 100 };
    const merged = mergeAppointmentActivity(old, { ...baseApp, status: 'Finalizado' }, now);
    expect(merged._updatedAtLocal).toBe(now);
  });
});

describe('mergeAppointmentsWithActivity', () => {
  it('faz merge em lote preservando timestamps anteriores', () => {
    const prev = [{ ...baseApp, _updatedAtLocal: 50 }];
    const data = [{ ...baseApp }];
    const merged = mergeAppointmentsWithActivity(prev, data, 99);
    expect(merged[0]._updatedAtLocal).toBe(50);
  });
});
