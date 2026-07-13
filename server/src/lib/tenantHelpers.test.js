import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  isReservedSlug,
  isValidSlug,
  normalizeSlug,
} = require('./tenantHelpers');

describe('normalizeSlug', () => {
  it('remove acentos e normaliza espaços', () => {
    expect(normalizeSlug('Minha Barbearia')).toBe('minha-barbearia');
    expect(normalizeSlug('São Paulo Shop')).toBe('sao-paulo-shop');
  });

  it('remove hífens das extremidades', () => {
    expect(normalizeSlug('--teste--')).toBe('teste');
  });
});

describe('isValidSlug', () => {
  it('aceita slug válido', () => {
    expect(isValidSlug('minha-barbearia')).toBe(true);
  });

  it('rejeita slug curto ou com caracteres inválidos', () => {
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('barbearia_01')).toBe(false);
    expect(isValidSlug('barbearia--dup')).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('identifica slugs reservados do sistema', () => {
    expect(isReservedSlug('admin')).toBe(true);
    expect(isReservedSlug('API')).toBe(true);
    expect(isReservedSlug('minha-barbearia')).toBe(false);
  });
});
