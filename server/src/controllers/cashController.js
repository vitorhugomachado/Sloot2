const prisma = require('../lib/prisma.js');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');
const {
  getOpenCashSession,
  summarizeSessionMovements,
  resolveStaffName,
} = require('../lib/financeV2');

function requireGerente(req, res) {
  if (req.user?.role !== 'Gerente') {
    res.status(403).json({ error: 'Apenas gestão pode realizar esta ação.' });
    return false;
  }
  return true;
}

function sessionPayload(session, movements = []) {
  const totals = summarizeSessionMovements(movements, session.openingFloat);
  return {
    ...session,
    movements,
    totals,
  };
}

const getCurrentCash = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const session = await getOpenCashSession(tenantId);
    if (!session) return res.json({ session: null });
    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: session.id, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ session: sessionPayload(session, movements) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar caixa atual' });
  }
};

const listCashSessions = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const sessions = await prisma.cashSession.findMany({
      where: { tenantId },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar caixas' });
  }
};

const getCashSession = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const session = await prisma.cashSession.findFirst({
      where: { id, tenantId },
    });
    if (!session) return res.status(404).json({ error: 'Caixa não encontrado' });
    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: id, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sessionPayload(session, movements));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar caixa' });
  }
};

const openCash = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const existing = await getOpenCashSession(tenantId);
    if (existing) {
      return res.status(409).json({
        error: 'Já existe um caixa aberto. Feche-o antes de abrir ou reabrir outro.',
        sessionId: existing.id,
      });
    }

    const openingFloat = Number(req.body.openingFloat || 0);
    const notes = req.body.notes ? String(req.body.notes) : null;
    const dateRaw = String(req.body.date || req.body.businessDate || '').trim();
    let openedAt = new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      // meio-dia local evita deslocar o dia por timezone
      openedAt = new Date(`${dateRaw}T12:00:00`);
      if (Number.isNaN(openedAt.getTime())) {
        return res.status(400).json({ error: 'Data inválida' });
      }
    }

    const session = await prisma.$transaction(async (tx) => {
      const openedByName = await resolveStaffName(req.user?.id, tx);
      const created = await tx.cashSession.create({
        data: {
          tenantId,
          status: 'OPEN',
          openingFloat,
          notes,
          openedAt,
          openedById: req.user?.id || null,
          openedByName: openedByName || null,
        },
      });
      if (openingFloat > 0) {
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: created.id,
            type: 'IN',
            source: 'OPENING',
            amount: openingFloat,
            method: 'Dinheiro',
            description: 'Troco inicial',
            createdAt: openedAt,
            createdById: req.user?.id || null,
          },
        });
      }
      return created;
    });

    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: session.id },
    });
    res.status(201).json(sessionPayload(session, movements));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao abrir caixa' });
  }
};

const reopenCash = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);

    const openExisting = await getOpenCashSession(tenantId);
    if (openExisting) {
      return res.status(409).json({
        error: 'Já existe um caixa aberto. Feche-o antes de reabrir outro.',
        sessionId: openExisting.id,
      });
    }

    const session = await prisma.cashSession.findFirst({
      where: { id, tenantId },
    });
    if (!session) return res.status(404).json({ error: 'Caixa não encontrado' });
    if (session.status === 'OPEN') {
      return res.status(409).json({ error: 'Este caixa já está aberto.' });
    }

    const reopened = await prisma.cashSession.update({
      where: { id },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedById: null,
        closedByName: null,
        countedCash: null,
        // mantém snapshot anterior como histórico interno em notes se útil — snapshot limpo ao reabrir
        snapshot: session.snapshot
          ? {
              ...(typeof session.snapshot === 'object' ? session.snapshot : {}),
              reopenedAt: new Date().toISOString(),
              previousClose: {
                closedAt: session.closedAt,
                countedCash: session.countedCash,
              },
            }
          : {
              reopenedAt: new Date().toISOString(),
              previousClose: {
                closedAt: session.closedAt,
                countedCash: session.countedCash,
              },
            },
        notes: req.body.notes != null ? String(req.body.notes) : session.notes,
      },
    });

    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: id, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sessionPayload(reopened, movements));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao reabrir caixa' });
  }
};

const closeCash = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const session = await getOpenCashSession(tenantId);
    if (!session) {
      return res.status(409).json({ error: 'Não há caixa aberto para fechar.' });
    }

    const countedCash = req.body.countedCash != null ? Number(req.body.countedCash) : null;
    const notes = req.body.notes != null ? String(req.body.notes) : session.notes;

    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: session.id, tenantId },
    });
    const totals = summarizeSessionMovements(movements, session.openingFloat);
    const difference =
      countedCash != null ? Number(countedCash) - Number(totals.expectedCash) : null;

    const closedByName = await resolveStaffName(req.user?.id);
    const closed = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: req.user?.id || null,
        closedByName: closedByName || null,
        countedCash,
        notes,
        snapshot: {
          ...totals,
          countedCash,
          difference,
          closedAt: new Date().toISOString(),
        },
      },
    });

    res.json(sessionPayload(closed, movements));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao fechar caixa' });
  }
};

const createCashMovement = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const session = await getOpenCashSession(tenantId);
    if (!session) {
      return res.status(409).json({ error: 'Abra o caixa do dia antes de lançar movimentos.' });
    }

    const type = String(req.body.type || '').toUpperCase();
    if (type !== 'IN' && type !== 'OUT') {
      return res.status(400).json({ error: 'type deve ser IN ou OUT' });
    }
    const amount = Number(req.body.amount || 0);
    if (!(amount > 0)) return res.status(400).json({ error: 'Valor inválido' });

    const movement = await prisma.cashMovement.create({
      data: {
        tenantId,
        cashSessionId: session.id,
        type,
        source: 'ADJUSTMENT',
        amount,
        method: String(req.body.method || 'Dinheiro'),
        description: String(req.body.description || (type === 'OUT' ? 'Sangria' : 'Suprimento')),
        createdById: req.user?.id || null,
      },
    });
    res.status(201).json(movement);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar movimento' });
  }
};

module.exports = {
  getCurrentCash,
  listCashSessions,
  getCashSession,
  openCash,
  reopenCash,
  closeCash,
  createCashMovement,
};
