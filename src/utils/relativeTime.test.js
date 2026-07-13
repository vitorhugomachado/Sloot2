import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

const NOW = new Date('2026-07-12T12:00:00').getTime();

describe('formatRelativeTime', () => {
  it('retorna vazio para timestamp inválido', () => {
    expect(formatRelativeTime(0, NOW)).toBe('');
    expect(formatRelativeTime('bad', NOW)).toBe('');
  });

  it('retorna agora para menos de 10 segundos', () => {
    expect(formatRelativeTime(NOW - 5000, NOW)).toBe('agora');
  });

  it('formata segundos e minutos', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe('há 30s');
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('há 5 min');
  });

  it('formata horas e dias', () => {
    expect(formatRelativeTime(NOW - 3 * 60 * 60_000, NOW)).toBe('há 3 h');
    expect(formatRelativeTime(NOW - 2 * 24 * 60 * 60_000, NOW)).toBe('há 2 dias');
    expect(formatRelativeTime(NOW - 24 * 60 * 60_000, NOW)).toBe('há 1 dia');
  });

  it('formata data para eventos antigos', () => {
    const old = new Date('2026-06-01T10:00:00').getTime();
    expect(formatRelativeTime(old, NOW)).toMatch(/\d{2}\/\d{2}/);
  });
});
