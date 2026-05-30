const DEFAULT_SERVICES = [
  { name: 'Corte de Cabelo', price: 50, duration: '45 min' },
  { name: 'Barba Completa', price: 35, duration: '30 min' },
];

function parseTime(timeStr) {
  const [h, m] = String(timeStr).split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h || 0, m || 0, 0));
}

/** Seg–sex 09–19, sáb 09–18, domingo fechado (padrão implement_working_hours.js). */
function defaultWorkingHoursRows(tenantId) {
  const weekday = (dia, open, close, lunchStart = '12:00', lunchEnd = '13:00') => ({
    tenantId,
    dia_semana: dia,
    is_aberto: true,
    hora_abertura: parseTime(open),
    hora_fechamento: parseTime(close),
    almoco_inicio: parseTime(lunchStart),
    almoco_fim: parseTime(lunchEnd),
  });

  return [
    weekday(1, '09:00', '19:00'),
    weekday(2, '09:00', '19:00'),
    weekday(3, '09:00', '19:00'),
    weekday(4, '09:00', '19:00'),
    weekday(5, '09:00', '19:00'),
    weekday(6, '09:00', '18:00'),
    {
      tenantId,
      dia_semana: 0,
      is_aberto: false,
      hora_abertura: parseTime('00:00'),
      hora_fechamento: parseTime('00:00'),
      almoco_inicio: null,
      almoco_fim: null,
    },
  ];
}

async function seedTenantDefaults(tx, tenantId, { services = false, workingHours = false } = {}) {
  if (services) {
    await tx.service.createMany({
      data: DEFAULT_SERVICES.map((s) => ({ ...s, tenantId })),
    });
  }
  if (workingHours) {
    await tx.workingHours.createMany({
      data: defaultWorkingHoursRows(tenantId),
    });
  }
}

module.exports = {
  DEFAULT_SERVICES,
  defaultWorkingHoursRows,
  seedTenantDefaults,
};
