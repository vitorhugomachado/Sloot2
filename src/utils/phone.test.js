import { describe, expect, it } from 'vitest';
import { isValidPhone, normalizePhone, PHONE_ERROR } from './phone';

describe('normalizePhone', () => {
  it('remove caracteres não numéricos', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('11987654321');
  });
});

describe('isValidPhone', () => {
  it('aceita telefone com 10 ou 11 dígitos', () => {
    expect(isValidPhone('1133334444')).toBe(true);
    expect(isValidPhone('11987654321')).toBe(true);
  });

  it('rejeita telefone curto ou longo demais', () => {
    expect(isValidPhone('123456789')).toBe(false);
    expect(isValidPhone('119876543210')).toBe(false);
  });
});

describe('PHONE_ERROR', () => {
  it('expõe mensagem padrão de validação', () => {
    expect(PHONE_ERROR).toContain('telefone válido');
  });
});
