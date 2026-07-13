import { describe, expect, it } from 'vitest';
import { getLocalPeriodRange, parseLocalDateIso, toIsoLocal } from './dateLocal';

describe('toIsoLocal', () => {
  it('formata data local como YYYY-MM-DD', () => {
    expect(toIsoLocal(new Date('2026-07-12T15:30:00'))).toBe('2026-07-12');
  });
});

describe('parseLocalDateIso', () => {
  it('interpreta data no meio-dia local para evitar bug de fuso', () => {
    const d = parseLocalDateIso('2026-05-31');
    expect(d.getHours()).toBe(12);
    expect(toIsoLocal(d)).toBe('2026-05-31');
  });
});

describe('getLocalPeriodRange', () => {
  it('retorna só o dia final quando dayCount é 0', () => {
    expect(getLocalPeriodRange('2026-07-12', 0)).toEqual({
      start: '2026-07-12',
      end: '2026-07-12',
    });
  });

  it('retorna intervalo inclusivo de 7 dias', () => {
    expect(getLocalPeriodRange('2026-07-12', 7)).toEqual({
      start: '2026-07-06',
      end: '2026-07-12',
    });
  });

  it('usa hoje quando endIso está vazio', () => {
    const today = toIsoLocal(new Date());
    expect(getLocalPeriodRange('', 0)).toEqual({ start: today, end: today });
  });
});
