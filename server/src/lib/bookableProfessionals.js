function timeToHHmm(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const match = value.match(/(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function workingHoursToShifts(rows) {
  return (rows || [])
    .filter((row) => row.is_aberto !== false)
    .map((row) => ({
      dia_semana: Number(row.dia_semana),
      hora_inicio: timeToHHmm(row.hora_abertura),
      hora_fim: timeToHHmm(row.hora_fechamento),
      almoco_inicio: timeToHHmm(row.almoco_inicio),
      almoco_fim: timeToHHmm(row.almoco_fim),
      ativo: true,
    }))
    .filter((row) => row.hora_inicio && row.hora_fim);
}

function bookableProfessionalWhere(tenantId, extra = {}) {
  return {
    tenantId,
    deletedAt: null,
    status: 'Ativo',
    acceptsAppointments: true,
    role: { in: ['Gerente', 'Barbeiro'] },
    ...extra,
  };
}

async function applyManagerWorkingHours(db, tenantId, professionals) {
  const list = professionals || [];
  if (!list.some((professional) => professional.role === 'Gerente')) return list;
  const workingHours = await db.workingHours.findMany({
    where: { tenantId },
    orderBy: { dia_semana: 'asc' },
  });
  const managerShifts = workingHoursToShifts(workingHours);
  return list.map((professional) => (
    professional.role === 'Gerente'
      ? { ...professional, shifts: managerShifts }
      : professional
  ));
}

async function findBookableProfessional(db, tenantId, id) {
  const professional = await db.barber.findFirst({
    where: bookableProfessionalWhere(tenantId, { id: Number(id) }),
    include: { shifts: true },
  });
  if (!professional) return null;
  const [resolved] = await applyManagerWorkingHours(db, tenantId, [professional]);
  return resolved;
}

module.exports = {
  applyManagerWorkingHours,
  bookableProfessionalWhere,
  findBookableProfessional,
  timeToHHmm,
  workingHoursToShifts,
};
