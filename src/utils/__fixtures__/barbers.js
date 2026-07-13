export const SUNDAY = '2026-07-12';

export const activeSundayBarber = {
  id: 1,
  status: 'Ativo',
  name: 'João',
  shifts: [
    {
      dia_semana: 0,
      ativo: true,
      hora_inicio: '09:00',
      hora_fim: '12:00',
      almoco_inicio: '11:00',
      almoco_fim: '11:30',
    },
  ],
  scheduleBlocks: [],
};

export const suspendedBarber = {
  id: 2,
  status: 'Suspenso',
  name: 'Pedro',
  shifts: activeSundayBarber.shifts,
  scheduleBlocks: [],
};

export const blockedDayBarber = {
  id: 3,
  status: 'Ativo',
  name: 'Carlos',
  shifts: activeSundayBarber.shifts,
  scheduleBlocks: [{ date: SUNDAY, startTime: null, endTime: null }],
};
