import { describe, expect, it } from 'vitest';
import { filterBookableProfessionals, isBookableProfessional } from './bookableProfessionals';

describe('bookableProfessionals', () => {
  it('inclui gerente e barbeiro ativos que participam da agenda', () => {
    const rows = filterBookableProfessionals([
      { id: 1, role: 'Gerente', status: 'Ativo', acceptsAppointments: true },
      { id: 2, role: 'Barbeiro', status: 'Ativo', acceptsAppointments: true },
    ]);
    expect(rows.map((row) => row.id)).toEqual([1, 2]);
  });

  it('exclui profissional suspenso ou com agenda desativada', () => {
    expect(isBookableProfessional({ role: 'Gerente', status: 'Ativo', acceptsAppointments: false })).toBe(false);
    expect(isBookableProfessional({ role: 'Barbeiro', status: 'Suspenso', acceptsAppointments: true })).toBe(false);
  });

  it('mantém compatibilidade com payload antigo sem o novo campo', () => {
    expect(isBookableProfessional({ role: 'Barbeiro', status: 'Ativo' })).toBe(true);
  });
});
