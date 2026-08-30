import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { SERVICE_BOOKING_ICONS, normalizeServiceBookingIcon } = require('../../src/lib/serviceBookingIcons');

describe('service booking icons', () => {
  it('aceita somente os ícones públicos suportados', () => {
    expect(SERVICE_BOOKING_ICONS).toEqual([
      'cut', 'beard', 'combo', 'razor', 'color', 'eyebrow', 'generic',
    ]);
    expect(normalizeServiceBookingIcon(' BEARD ')).toBe('beard');
    expect(normalizeServiceBookingIcon('unknown')).toBeNull();
  });

  it('mantém clientes antigos compatíveis com o fallback genérico', () => {
    expect(normalizeServiceBookingIcon()).toBe('generic');
    expect(normalizeServiceBookingIcon('')).toBe('generic');
  });
});
