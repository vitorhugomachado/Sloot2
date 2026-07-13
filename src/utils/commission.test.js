import { describe, expect, it } from 'vitest';
import {
  buildCommissionReport,
  getShopPercent,
  indexBarbersById,
  splitAppointmentCommission,
} from './commission';

describe('getShopPercent', () => {
  it('usa 50% como padrão', () => {
    expect(getShopPercent(null)).toBe(50);
    expect(getShopPercent({})).toBe(50);
  });

  it('limita percentual entre 0 e 100', () => {
    expect(getShopPercent({ commission: 150 })).toBe(100);
    expect(getShopPercent({ commission: -10 })).toBe(0);
  });
});

describe('splitAppointmentCommission', () => {
  it('divide valor entre barbearia e barbeiro', () => {
    expect(splitAppointmentCommission(100, 50)).toEqual({ house: 50, barber: 50 });
    expect(splitAppointmentCommission(80, 25)).toEqual({ house: 20, barber: 60 });
  });
});

describe('indexBarbersById', () => {
  it('indexa barbeiros por id numérico', () => {
    const map = indexBarbersById([{ id: 3, name: 'Ana' }, { id: '7', name: 'Bob' }]);
    expect(map[3].name).toBe('Ana');
    expect(map[7].name).toBe('Bob');
  });
});

describe('buildCommissionReport', () => {
  const barbersById = indexBarbersById([
    { id: 1, name: 'João Silva', commission: 40 },
    { id: 2, name: 'Maria Souza', commission: 50 },
  ]);

  const appointments = [
    {
      id: 10,
      date: '2026-07-10',
      time: '10:00',
      customer: 'Cliente A',
      service: 'Corte',
      barberId: 1,
      price: 100,
    },
    {
      id: 11,
      date: '2026-07-11',
      time: '11:00',
      customer: 'Cliente B',
      service: 'Barba',
      barberId: 2,
      price: 60,
    },
  ];

  it('calcula totais e linhas do relatório', () => {
    const report = buildCommissionReport(appointments, barbersById);
    expect(report.totals.count).toBe(2);
    expect(report.totals.totalService).toBe(160);
    expect(report.totals.totalHouse).toBe(70);
    expect(report.totals.totalBarber).toBe(90);
    const joaoRow = report.rows.find((row) => row.appointmentId === 10);
    expect(joaoRow.shopPct).toBe(40);
  });

  it('agrega por barbeiro', () => {
    const report = buildCommissionReport(appointments, barbersById);
    expect(report.byBarber).toHaveLength(2);
    expect(report.byBarber[0].totalService).toBeGreaterThanOrEqual(report.byBarber[1].totalService);
  });

  it('filtra por barbeiro específico', () => {
    const report = buildCommissionReport(appointments, barbersById, { filterBarberId: 2 });
    expect(report.totals.count).toBe(1);
    expect(report.rows[0].barberId).toBe(2);
  });
});
