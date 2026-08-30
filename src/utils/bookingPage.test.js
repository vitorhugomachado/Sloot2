import { describe, expect, it } from 'vitest';
import {
  groupWeeklyHours,
  managerHoursFromPublic,
  normalizeBookingPageConfig,
  resolveBookingPreferences,
} from './bookingPage.js';

describe('bookingPage frontend utils', () => {
  it('agrupa dias consecutivos com os mesmos períodos e preserva almoço', () => {
    const days = [1, 2, 3].map((dayOfWeek) => ({
      dayOfWeek,
      configured: true,
      isOpen: true,
      periods: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '18:00' },
      ],
    }));

    expect(groupWeeklyHours(days)).toEqual([{
      days: 'Seg–Qua',
      hours: '09:00–12:00 / 13:00–18:00',
      isOpen: true,
    }]);
  });

  it('mantém dias sem linha como não informados no editor', () => {
    const rows = managerHoursFromPublic([{ dayOfWeek: 1, configured: true, isOpen: false }]);

    expect(rows).toHaveLength(7);
    expect(rows[0].configured).toBe(false);
    expect(rows[1]).toMatchObject({ configured: true, isOpen: false });
  });

  it('remove IDs duplicados e limita a galeria a cinco itens', () => {
    const config = normalizeBookingPageConfig({
      galleryAssetIds: ['a', 'a', 'b', 'c', 'd', 'e', 'f'],
    });

    expect(config.galleryAssetIds).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('descarta serviço ou profissional que deixou de estar ativo', () => {
    const result = resolveBookingPreferences({
      serviceId: '99',
      professionalId: '2',
      services: [{ id: 1, name: 'Corte' }],
      professionals: [{ id: 2, name: 'Ana' }],
    });

    expect(result.service).toBeNull();
    expect(result.professional?.name).toBe('Ana');
    expect(result.invalidService).toBe(true);
    expect(result.warning).toMatch(/serviço.*removida/i);
  });
});
