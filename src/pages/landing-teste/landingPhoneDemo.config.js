import { toIsoLocal } from '../../utils/dateLocal';

export const DEMO_SERVICES = [
  { id: 'demo-svc-1', name: 'Corte tradicional', duration: '30 min', price: 45 },
  { id: 'demo-svc-2', name: 'Barba completa', duration: '20 min', price: 35 },
  { id: 'demo-svc-3', name: 'Corte + barba', duration: '50 min', price: 70 },
];

export const DEMO_BARBERS = [
  { id: 'demo-barber-1', name: 'Rafael', role: 'Barbeiro', status: 'Ativo' },
  { id: 'demo-barber-2', name: 'Lucas', role: 'Barbeiro', status: 'Ativo' },
  { id: 'demo-barber-3', name: 'Diego', role: 'Barbeiro', status: 'Ativo' },
];

export const DEMO_TIME_SLOTS = ['09:00', '10:30', '14:00', '16:30'];

export const DEMO_CUSTOMER = { name: 'João Silva', phone: '(11) 99999-9999' };

/** Próximos N dias úteis (seg–sex) a partir de hoje. */
export function getDemoWorkingDayIsos(count = 5) {
  const isos = [];
  const cursor = new Date();
  while (isos.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      isos.push(toIsoLocal(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return isos;
}
