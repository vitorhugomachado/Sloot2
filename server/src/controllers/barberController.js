const prisma = require('../lib/prisma.js');
const { hashPassword } = require('../utils/auth');
const { defaultDateRange } = require('./scheduleBlockController');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { assertModuleEnabled } = require('../lib/tenantModules');
const {
  applyManagerWorkingHours,
  bookableProfessionalWhere,
} = require('../lib/bookableProfessionals');

async function attachScheduleBlocks(barbers, from, to) {
  if (!Array.isArray(barbers) || barbers.length === 0) return barbers;
  const ids = barbers.map((b) => b.id);
  const blocks = await prisma.barberScheduleBlock.findMany({
    where: { barberId: { in: ids }, date: { gte: from, lte: to } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  const byBarber = {};
  for (const bl of blocks) {
    if (!byBarber[bl.barberId]) byBarber[bl.barberId] = [];
    byBarber[bl.barberId].push(bl);
  }
  return barbers.map((b) => ({ ...b, scheduleBlocks: byBarber[b.id] || [] }));
}

/** Only scalar fields that exist on Barber — avoids Prisma errors from stray JSON keys. */
const BARBER_WRITABLE_KEYS = [
  'name',
  'email',
  'role',
  'status',
  'foto_perfil',
  'whatsapp',
  'bio',
  'commission',
  'chave_pix',
  'data_admissao',
  'permissions',
  'specialties',
  'acceptsAppointments',
];

function pickBarberScalars(body) {
  const out = {};
  for (const key of BARBER_WRITABLE_KEYS) {
    if (body[key] === undefined) continue;
    out[key] = body[key];
  }
  if (typeof out.email === 'string') {
    out.email = out.email.trim();
  }
  if (out.commission !== undefined && out.commission !== null && out.commission !== '') {
    const n = Number(out.commission);
    if (Number.isFinite(n)) out.commission = n;
    else delete out.commission;
  } else {
    delete out.commission;
  }
  if (out.permissions != null && !Array.isArray(out.permissions)) {
    delete out.permissions;
  }
  if (out.specialties != null && !Array.isArray(out.specialties)) {
    if (typeof out.specialties === 'string') {
      try {
        const parsed = JSON.parse(out.specialties);
        out.specialties = Array.isArray(parsed) ? parsed : [];
      } catch {
        delete out.specialties;
      }
    } else {
      delete out.specialties;
    }
  }
  if (out.foto_perfil === '') {
    delete out.foto_perfil;
  }
  return out;
}

function normalizeShiftsForCreate(shiftsRaw) {
  if (!Array.isArray(shiftsRaw) || shiftsRaw.length === 0) return [];
  const mapped = shiftsRaw
    .map((s) => ({
      dia_semana: Number(s.dia_semana),
      hora_inicio: String(s.hora_inicio ?? '09:00'),
      hora_fim: String(s.hora_fim ?? '18:00'),
      almoco_inicio: String(s.almoco_inicio ?? '12:00'),
      almoco_fim: String(s.almoco_fim ?? '13:00'),
      ativo: s.ativo !== false && s.ativo !== 'false',
    }))
    .filter((s) => Number.isInteger(s.dia_semana) && s.dia_semana >= 0 && s.dia_semana <= 6);
  /** @@id([id_barbeiro, dia_semana, hora_inicio]) — duplicatas quebram o createMany */
  const seen = new Set();
  return mapped.filter((s) => {
    const k = `${s.dia_semana}|${s.hora_inicio}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const barberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  permissions: true,
  foto_perfil: true,
  shifts: true,
  acceptsAppointments: true,
};

/** Lista pública mínima (agendamento online) — sem email nem permissões */
const barberPublicSelect = {
  id: true,
  name: true,
  role: true,
  status: true,
  foto_perfil: true,
  shifts: true,
  acceptsAppointments: true,
};

async function fetchPublicBarbers(tenantId, from, to) {
  const range = defaultDateRange();
  const fromDate = String(from || range.from);
  const toDate = String(to || range.to);
  const barbersRaw = await prisma.barber.findMany({
    where: bookableProfessionalWhere(tenantId),
    select: barberPublicSelect,
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  const barbers = await applyManagerWorkingHours(prisma, tenantId, barbersRaw);
  return attachScheduleBlocks(barbers, fromDate, toDate);
}

const getBarbers = async (req, res) => {
  try {
    const range = defaultDateRange();
    const from = String(req.query.from || range.from);
    const to = String(req.query.to || range.to);

    const tenantId = tenantIdFromReq(req);
    if (!req.user) {
      return res.json(await fetchPublicBarbers(tenantId, from, to));
    }
    if (req.user.role === 'Gerente') {
      const barbers = await prisma.barber.findMany({
        where: { ...tenantWhere(req), deletedAt: null },
        select: barberSelect,
      });
      return res.json(await attachScheduleBlocks(barbers, from, to));
    }
    const self = await prisma.barber.findFirst({
      where: { id: Number(req.user.id), tenantId, deletedAt: null },
      select: barberSelect,
    });
    const list = self ? [self] : [];
    return res.json(await attachScheduleBlocks(list, from, to));
  } catch (error) {
    console.error('Get barbers error:', error);
    res.status(500).json({ message: 'Erro ao buscar barbeiros' });
  }
};

const createBarber = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode cadastrar profissionais.' });
    }
    try {
      await assertModuleEnabled(req, 'users');
    } catch (err) {
      return res.status(err.status || 403).json({ message: err.message || 'Acesso negado.' });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { password, shifts: shiftsRaw } = body;
    const data = pickBarberScalars(body);

    if (!data.email) {
      return res.status(400).json({ message: 'E-mail é obrigatório' });
    }

    // Regra: Limpar e-mail antigo de barbeiro removido (Soft delete legacy fix)
    const tenantId = tenantIdFromReq(req);
    const existingBarber = await prisma.barber.findUnique({
      where: { tenantId_email: { tenantId, email: data.email.toLowerCase() } },
    });
    if (existingBarber) {
      if (existingBarber.deletedAt) {
        await prisma.barber.update({
          where: { id: existingBarber.id },
          data: { email: `${existingBarber.email}_deleted_legacy_${Date.now()}` },
        });
      } else {
        return res.status(400).json({ message: 'E-mail já cadastrado' });
      }
    }

    const shifts = normalizeShiftsForCreate(shiftsRaw);
    const hashedPassword = await hashPassword(password || '123');

    if (data.permissions == null) {
      data.permissions = ['scheduler', 'clients'];
    }

    const barber = await prisma.barber.create({
      data: {
        ...data,
        tenantId,
        password: hashedPassword,
        shifts:
          shifts.length > 0
            ? {
                create: shifts.map((s) => ({
                  dia_semana: s.dia_semana,
                  hora_inicio: s.hora_inicio,
                  hora_fim: s.hora_fim,
                  almoco_inicio: s.almoco_inicio,
                  almoco_fim: s.almoco_fim,
                  ativo: s.ativo,
                })),
              }
            : undefined,
      },
      include: { shifts: true, scheduleBlocks: true },
    });

    invalidatePublicCache(req.tenantSlug);
    const { password: _pw, ...barberData } = barber;
    res.status(201).json(barberData);
  } catch (error) {
    console.error('Erro ao criar barbeiro:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'E-mail já cadastrado' });
    }
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Erro ao criar barbeiro',
        details: error.message || String(error),
      });
    }
  }
};

const updateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = Number(id);
    const isGerente = req.user?.role === 'Gerente';
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' });
    }
    if (!isGerente && targetId !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Sem permissão para alterar este profissional.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { password, shifts: shiftsRaw } = body;
    const data = pickBarberScalars(body);

    if (isGerente && (data.permissions !== undefined || data.role !== undefined || data.status !== undefined)) {
      try {
        await assertModuleEnabled(req, 'users');
      } catch (err) {
        return res.status(err.status || 403).json({ message: err.message || 'Acesso negado.' });
      }
    }

    if (!isGerente) {
      delete data.permissions;
      delete data.role;
      delete data.status;
    }

    const rawPwd = password !== undefined && password !== null ? String(password).trim() : '';
    if (rawPwd.length > 0) {
      try {
        data.password = await hashPassword(rawPwd);
      } catch (e) {
        console.error('hashPassword error:', e);
        return res.status(400).json({
          message: 'Não foi possível processar a nova senha.',
          details: e.message || String(e),
        });
      }
    }

    Object.keys(data).forEach((k) => {
      if (data[k] === undefined) delete data[k];
    });

    const hasShiftUpdate = shiftsRaw !== undefined;
    const hasBarberScalarUpdate = Object.keys(data).length > 0;

    if (!hasBarberScalarUpdate && !hasShiftUpdate) {
      const existing = await prisma.barber.findFirst({
        where: { id: Number(id), ...tenantWhere(req) },
        include: { shifts: true, scheduleBlocks: true },
      });
      if (!existing) return res.status(404).json({ message: 'Barbeiro não encontrado' });
      const { password: _p, ...barberData } = existing;
      return res.json(barberData);
    }

    const barber = await prisma.$transaction(async (tx) => {
      if (hasShiftUpdate) {
        const shifts = normalizeShiftsForCreate(shiftsRaw);
        await tx.workingShifts.deleteMany({ where: { id_barbeiro: Number(id) } });
        if (shifts.length > 0) {
          await tx.workingShifts.createMany({
            data: shifts.map((s) => ({
              id_barbeiro: Number(id),
              dia_semana: s.dia_semana,
              hora_inicio: s.hora_inicio,
              hora_fim: s.hora_fim,
              almoco_inicio: s.almoco_inicio,
              almoco_fim: s.almoco_fim,
              ativo: s.ativo,
            })),
          });
        }
      }

      if (!hasBarberScalarUpdate) {
        return tx.barber.findUniqueOrThrow({
          where: { id: Number(id) },
          include: { shifts: true, scheduleBlocks: true },
        });
      }

      return await tx.barber.update({
        where: { id: Number(id) },
        data,
        include: { shifts: true, scheduleBlocks: true },
      });
    });
    
    invalidatePublicCache(req.tenantSlug);
    const { password: _, ...barberData } = barber;
    res.json(barberData);
  } catch (error) {
    console.error('Erro ao atualizar barbeiro:', error);
    if (!res.headersSent) {
      const code = error.code || error.meta?.target;
      res.status(500).json({
        message: 'Erro ao atualizar barbeiro',
        details: [error.message || String(error), code].filter(Boolean).join(' '),
      });
    }
  }
};

const deleteBarber = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode remover profissionais.' });
    }
    const { id } = req.params;
    
    // Buscar barbeiro antes de excluir para pegar o e-mail atual
    const barber = await prisma.barber.findFirst({
      where: { id: Number(id), ...tenantWhere(req) },
    });
    if (!barber) return res.status(404).json({ message: 'Barbeiro não encontrado' });

    await prisma.barber.update({
      where: { id: Number(id) },
      data: { 
        deletedAt: new Date(), 
        status: 'Removido',
        email: `${barber.email}_deleted_${Date.now()}` // Libera o e-mail
      }
    });
    invalidatePublicCache(req.tenantSlug);
    res.sendStatus(204);
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Erro ao excluir barbeiro' });
  }
};

module.exports = {
  getBarbers,
  fetchPublicBarbers,
  createBarber,
  updateBarber,
  deleteBarber,
};
