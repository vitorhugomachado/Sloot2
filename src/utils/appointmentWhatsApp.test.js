import { describe, expect, it } from 'vitest';
import {
  buildWhatsAppConfirmMessage,
  normalizePhoneForWhatsApp,
  toBrDate,
} from './appointmentWhatsApp';

describe('normalizePhoneForWhatsApp', () => {
  it('retorna null sem telefone', () => {
    expect(normalizePhoneForWhatsApp('')).toBeNull();
  });

  it('prefixa 55 quando ausente', () => {
    expect(normalizePhoneForWhatsApp('11987654321')).toBe('5511987654321');
  });

  it('mantém prefixo internacional existente', () => {
    expect(normalizePhoneForWhatsApp('5511987654321')).toBe('5511987654321');
  });

  it('remove prefixo 00', () => {
    expect(normalizePhoneForWhatsApp('005511987654321')).toBe('5511987654321');
  });
});

describe('toBrDate', () => {
  it('converte ISO para DD/MM/YYYY', () => {
    expect(toBrDate('2026-07-12')).toBe('12/07/2026');
  });

  it('retorna string original quando formato inválido', () => {
    expect(toBrDate('12/07/2026')).toBe('12/07/2026');
  });
});

describe('buildWhatsAppConfirmMessage', () => {
  it('monta mensagem codificada para URL', () => {
    const encoded = buildWhatsAppConfirmMessage({
      customer: 'Maria',
      date: '2026-07-12',
      time: '10:00',
    });
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toContain('Maria');
    expect(decoded).toContain('12/07/2026');
    expect(decoded).toContain('10:00');
  });
});
