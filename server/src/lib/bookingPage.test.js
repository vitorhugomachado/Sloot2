import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  BookingSettingsValidationError,
  buildPublicBookingPage,
  normalizeBookingPageConfig,
  normalizeWeeklyHours,
  serializeWeeklyHours,
} = require('./bookingPage.js');

const IDS = [
  '7b3dd63c-ae8f-4a6c-b4a8-1ee0bd9d3d01',
  '7b3dd63c-ae8f-4a6c-b4a8-1ee0bd9d3d02',
  '7b3dd63c-ae8f-4a6c-b4a8-1ee0bd9d3d03',
  '7b3dd63c-ae8f-4a6c-b4a8-1ee0bd9d3d04',
  '7b3dd63c-ae8f-4a6c-b4a8-1ee0bd9d3d05',
  '7b3dd63c-ae8f-4a6c-b4a8-1ee0bd9d3d06',
];

describe('bookingPage', () => {
  it('normaliza textos, UUIDs únicos e a versão do schema', () => {
    const config = normalizeBookingPageConfig({
      schemaVersion: 99,
      heroTitle: '  Um novo jeito de agendar  ',
      coverAssetId: IDS[0].toUpperCase(),
      galleryAssetIds: [IDS[1], IDS[1], IDS[2]],
    });

    expect(config).toEqual({
      schemaVersion: 1,
      heroTitle: 'Um novo jeito de agendar',
      heroText: null,
      about: null,
      coverAssetId: IDS[0],
      galleryAssetIds: [IDS[1], IDS[2]],
    });
  });

  it('rejeita textos acima do limite e mais de cinco imagens', () => {
    expect(() => normalizeBookingPageConfig({
      heroTitle: 'x'.repeat(121),
      galleryAssetIds: IDS,
    })).toThrow(BookingSettingsValidationError);
  });

  it('não inventa endereço, avaliação, galeria ou expediente', () => {
    const page = buildPublicBookingPage({ slug: 'tenant-real', name: 'Tenant real' }, []);

    expect(page).toMatchObject({
      heroTitle: 'Agende seu horário',
      heroText: '',
      about: null,
      coverUrl: null,
      galleryUrls: [],
      weeklyHours: [],
    });
    expect(page).not.toHaveProperty('rating');
    expect(page).not.toHaveProperty('address');
  });

  it('valida abertura, fechamento e intervalo dentro do expediente', () => {
    expect(() => normalizeWeeklyHours([{
      dayOfWeek: 1,
      configured: true,
      isOpen: true,
      opensAt: '18:00',
      closesAt: '09:00',
    }])).toThrow(/Expediente semanal inválido/);

    expect(() => normalizeWeeklyHours([{
      dayOfWeek: 2,
      configured: true,
      isOpen: true,
      opensAt: '09:00',
      closesAt: '18:00',
      breakStart: '08:00',
      breakEnd: '12:00',
    }])).toThrow(/Expediente semanal inválido/);
  });

  it('estrutura os dois períodos quando existe almoço', () => {
    const [row] = serializeWeeklyHours([{
      dia_semana: 3,
      is_aberto: true,
      hora_abertura: new Date('1970-01-01T09:00:00.000Z'),
      hora_fechamento: new Date('1970-01-01T18:00:00.000Z'),
      almoco_inicio: new Date('1970-01-01T12:00:00.000Z'),
      almoco_fim: new Date('1970-01-01T13:00:00.000Z'),
    }]);

    expect(row.periods).toEqual([
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '18:00' },
    ]);
  });
});
