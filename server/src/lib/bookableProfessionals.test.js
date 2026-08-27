import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  bookableProfessionalWhere,
  timeToHHmm,
  workingHoursToShifts,
} = require('./bookableProfessionals');

describe('bookableProfessionals backend', () => {
  it('converte horário geral em turnos do gerente e ignora dias fechados', () => {
    const shifts = workingHoursToShifts([
      {
        dia_semana: 1,
        is_aberto: true,
        hora_abertura: new Date('1970-01-01T09:00:00.000Z'),
        hora_fechamento: new Date('1970-01-01T19:00:00.000Z'),
        almoco_inicio: new Date('1970-01-01T12:00:00.000Z'),
        almoco_fim: new Date('1970-01-01T13:00:00.000Z'),
      },
      {
        dia_semana: 0,
        is_aberto: false,
        hora_abertura: new Date('1970-01-01T00:00:00.000Z'),
        hora_fechamento: new Date('1970-01-01T00:00:00.000Z'),
      },
    ]);
    expect(shifts).toEqual([{
      dia_semana: 1,
      hora_inicio: '09:00',
      hora_fim: '19:00',
      almoco_inicio: '12:00',
      almoco_fim: '13:00',
      ativo: true,
    }]);
  });

  it('gera filtro estrito por tenant, status e participação na agenda', () => {
    expect(bookableProfessionalWhere(42)).toMatchObject({
      tenantId: 42,
      deletedAt: null,
      status: 'Ativo',
      acceptsAppointments: true,
      role: { in: ['Gerente', 'Barbeiro'] },
    });
  });

  it('normaliza horários de texto e Date', () => {
    expect(timeToHHmm('09:30:00')).toBe('09:30');
    expect(timeToHHmm(new Date('1970-01-01T18:45:00.000Z'))).toBe('18:45');
  });
});
