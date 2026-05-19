const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function defaultDateRange() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 90);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function normalizeBlockBody(body) {
  const date = String(body?.date ?? '').trim();
  if (!DATE_RE.test(date)) {
    return { error: 'Data inválida. Use o formato YYYY-MM-DD.' };
  }

  const fullDay = body?.fullDay === true || body?.fullDay === 'true';
  let startTime = body?.startTime != null ? String(body.startTime).trim() : null;
  let endTime = body?.endTime != null ? String(body.endTime).trim() : null;

  if (fullDay) {
    startTime = null;
    endTime = null;
  } else {
    if (!startTime || !endTime || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return { error: 'Informe horário de início e fim válidos (HH:mm) ou marque dia inteiro.' };
    }
    if (startTime >= endTime) {
      return { error: 'O horário de início deve ser anterior ao fim.' };
    }
  }

  const reason = body?.reason != null ? String(body.reason).trim() || null : null;
  return { date, startTime, endTime, reason };
}

const listScheduleBlocks = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode consultar bloqueios de agenda.' });
    }
    const barberId = Number(req.params.id);
    if (!Number.isFinite(barberId)) {
      return res.status(400).json({ message: 'ID do profissional inválido.' });
    }

    const defaults = defaultDateRange();
    const from = String(req.query.from || defaults.from);
    const to = String(req.query.to || defaults.to);

    const blocks = await prisma.barberScheduleBlock.findMany({
      where: { barberId, date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json(blocks);
  } catch (error) {
    console.error('listScheduleBlocks:', error);
    res.status(500).json({ message: 'Erro ao listar horários fechados.' });
  }
};

const createScheduleBlock = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode bloquear horários.' });
    }
    const barberId = Number(req.params.id);
    if (!Number.isFinite(barberId)) {
      return res.status(400).json({ message: 'ID do profissional inválido.' });
    }

    const barber = await prisma.barber.findFirst({
      where: { id: barberId, deletedAt: null },
      select: { id: true },
    });
    if (!barber) return res.status(404).json({ message: 'Profissional não encontrado.' });

    const normalized = normalizeBlockBody(req.body);
    if (normalized.error) return res.status(400).json({ message: normalized.error });

    const block = await prisma.barberScheduleBlock.create({
      data: {
        barberId,
        date: normalized.date,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        reason: normalized.reason,
      },
    });
    res.status(201).json(block);
  } catch (error) {
    console.error('createScheduleBlock:', error);
    res.status(500).json({ message: 'Erro ao criar bloqueio de horário.' });
  }
};

const deleteScheduleBlock = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode remover bloqueios.' });
    }
    const barberId = Number(req.params.id);
    const blockId = Number(req.params.blockId);
    if (!Number.isFinite(barberId) || !Number.isFinite(blockId)) {
      return res.status(400).json({ message: 'Identificadores inválidos.' });
    }

    const existing = await prisma.barberScheduleBlock.findFirst({
      where: { id: blockId, barberId },
    });
    if (!existing) return res.status(404).json({ message: 'Bloqueio não encontrado.' });

    await prisma.barberScheduleBlock.delete({ where: { id: blockId } });
    res.status(204).send();
  } catch (error) {
    console.error('deleteScheduleBlock:', error);
    res.status(500).json({ message: 'Erro ao remover bloqueio.' });
  }
};

/** Blocos públicos para agendamento online (todos barbeiros ativos no intervalo). */
const getPublicScheduleBlocks = async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const from = String(req.query.from || defaults.from);
    const to = String(req.query.to || defaults.to);

    const activeBarbers = await prisma.barber.findMany({
      where: { deletedAt: null, status: 'Ativo', role: 'Barbeiro' },
      select: { id: true },
    });
    const ids = activeBarbers.map((b) => b.id);
    if (ids.length === 0) return res.json([]);

    const blocks = await prisma.barberScheduleBlock.findMany({
      where: { barberId: { in: ids }, date: { gte: from, lte: to } },
      orderBy: [{ barberId: 'asc' }, { date: 'asc' }],
    });
    res.json(blocks);
  } catch (error) {
    console.error('getPublicScheduleBlocks:', error);
    res.status(500).json({ message: 'Erro ao buscar disponibilidade.' });
  }
};

module.exports = {
  listScheduleBlocks,
  createScheduleBlock,
  deleteScheduleBlock,
  getPublicScheduleBlocks,
  defaultDateRange,
};
