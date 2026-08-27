const prisma = require('../lib/prisma.js');
const { tenantIdFromReq } = require('../lib/tenantHelpers');
const {
  getOpenCashSession,
  summarizeSessionMovements,
  resolveStaffName,
  writeLedgerEntry,
  writeAuditLog,
} = require('../lib/financeV2');

function requireGerente(req, res) {
  if (req.user?.role !== 'Gerente') {
    res.status(403).json({ error: 'Apenas gestão pode realizar esta ação.' });
    return false;
  }
  return true;
}

function sessionPayload(session, movements = [], extra = {}) {
  const totals = summarizeSessionMovements(movements, session.openingFloat);
  return {
    ...session,
    movements,
    totals,
    ...extra,
  };
}

function operationalSessionPayload(session) {
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    openedAt: session.openedAt,
  };
}

const getCurrentCash = async (req, res) => {
  try {
    const tenantId = tenantIdFromReq(req);
    const session = await getOpenCashSession(tenantId);
    if (!session) return res.json({ session: null });
    if (req.user?.role !== 'Gerente') {
      return res.json({ session: operationalSessionPayload(session) });
    }
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
    if (req.user?.role !== 'Gerente') {
      const session = await getOpenCashSession(tenantId);
      return res.json(session ? [operationalSessionPayload(session)] : []);
    }
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
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);
    const session = await prisma.cashSession.findFirst({
      where: { id, tenantId },
    });
    if (!session) return res.status(404).json({ error: 'Caixa não encontrado' });

    const [movements, comandas, expenses] = await Promise.all([
      prisma.cashMovement.findMany({
        where: { cashSessionId: id, tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.comanda.findMany({
        where: { tenantId, cashSessionId: id, status: 'QUITADA' },
        include: {
          items: {
            select: {
              name: true,
              itemType: true,
              quantity: true,
              unitPrice: true,
              total: true,
            },
          },
        },
        orderBy: { closedAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: { tenantId, cashSessionId: id },
        orderBy: { id: 'desc' },
      }),
    ]);

    const adjustments = movements.filter((m) => m.source === 'ADJUSTMENT');

    const comandaById = Object.fromEntries(comandas.map((c) => [c.id, c]));
    const byMethodDetail = {};
    for (const m of movements) {
      if (m.source !== 'COMANDA' || m.type !== 'IN') continue;
      const method = m.method || 'Outro';
      if (!byMethodDetail[method]) byMethodDetail[method] = [];
      const c = m.referenceId ? comandaById[m.referenceId] : null;
      byMethodDetail[method].push({
        comandaId: m.referenceId || null,
        number: c?.number ?? null,
        customerName: c?.customerName ?? null,
        amount: Number(m.amount || 0),
      });
    }

    // Inclui comandas QUITADA que possam não estar no mapa (já buscadas)
    // e também PARTIAL ligadas à sessão, só para composição de detalhe por método
    const missingIds = [
      ...new Set(
        movements
          .filter((m) => m.source === 'COMANDA' && m.referenceId && !comandaById[m.referenceId])
          .map((m) => m.referenceId),
      ),
    ];
    if (missingIds.length) {
      const extra = await prisma.comanda.findMany({
        where: { tenantId, id: { in: missingIds } },
        select: { id: true, number: true, customerName: true },
      });
      for (const c of extra) {
        for (const method of Object.keys(byMethodDetail)) {
          for (const row of byMethodDetail[method]) {
            if (row.comandaId === c.id) {
              row.number = c.number;
              row.customerName = c.customerName;
            }
          }
        }
      }
    }

    res.json(
      sessionPayload(session, movements, {
        composition: {
          comandas: comandas.map((c) => ({
            id: c.id,
            number: c.number,
            customerName: c.customerName,
            total: c.total,
            barberId: c.barberId,
            closedAt: c.closedAt,
            payments: c.payments,
            items: c.items,
          })),
          expenses,
          adjustments,
          byMethodDetail,
        },
      }),
    );
  } catch (error) {
    console.error(error);
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
      openedAt = new Date(`${dateRaw}T12:00:00`);
      if (Number.isNaN(openedAt.getTime())) {
        return res.status(400).json({ error: 'Data inválida' });
      }
    }

    const session = await prisma.$transaction(async (tx) => {
      // Recheck while holding a serializable transaction. The preliminary check
      // above is useful for the common path, but cannot prevent two concurrent
      // requests from both observing that no session is open.
      const concurrentExisting = await getOpenCashSession(tenantId, tx);
      if (concurrentExisting) {
        const conflict = new Error('Já existe um caixa aberto para este estabelecimento.');
        conflict.code = 'CASH_ALREADY_OPEN';
        throw conflict;
      }

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
        await writeLedgerEntry(tx, {
          tenantId,
          kind: 'ADJUSTMENT',
          amount: openingFloat,
          direction: 'IN',
          method: 'Dinheiro',
          account: 'CAIXA',
          referenceType: 'CashSession',
          referenceId: created.id,
          description: 'Troco inicial',
          createdById: req.user?.id || null,
          occurredAt: openedAt,
        });
      }
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        userName: openedByName,
        action: 'OPEN_CASH',
        entity: 'CashSession',
        entityId: created.id,
        payload: { openingFloat, notes, openedAt },
      });
      return created;
    }, { isolationLevel: 'Serializable' });

    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: session.id },
    });
    res.status(201).json(sessionPayload(session, movements));
  } catch (error) {
    console.error(error);
    if (['P2002', 'P2034', 'CASH_ALREADY_OPEN'].includes(error?.code)) {
      return res.status(409).json({
        error: 'Já existe um caixa aberto para este estabelecimento.',
        code: 'CASH_ALREADY_OPEN',
      });
    }
    res.status(500).json({ error: 'Erro ao abrir caixa' });
  }
};

const reopenCash = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;
    const tenantId = tenantIdFromReq(req);
    const id = parseInt(req.params.id, 10);

    const reason = String(req.body.reason || '').trim();
    if (reason.length < 3) {
      return res.status(400).json({
        error: 'Informe o motivo da reabertura (mínimo 3 caracteres).',
        code: 'REASON_REQUIRED',
      });
    }

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

    const reopened = await prisma.$transaction(async (tx) => {
      const userName = await resolveStaffName(req.user?.id, tx);
      const updated = await tx.cashSession.update({
        where: { id },
        data: {
          status: 'OPEN',
          closedAt: null,
          closedById: null,
          closedByName: null,
          countedCash: null,
          snapshot: session.snapshot
            ? {
                ...(typeof session.snapshot === 'object' ? session.snapshot : {}),
                reopenedAt: new Date().toISOString(),
                reopenReason: reason,
                previousClose: {
                  closedAt: session.closedAt,
                  countedCash: session.countedCash,
                },
              }
            : {
                reopenedAt: new Date().toISOString(),
                reopenReason: reason,
                previousClose: {
                  closedAt: session.closedAt,
                  countedCash: session.countedCash,
                },
              },
          notes: [
            session.notes || '',
            req.body.notes != null ? String(req.body.notes) : '',
            `Reabertura: ${reason}`,
          ].filter(Boolean).join(' | ') || reason,
        },
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        userName,
        action: 'REOPEN_CASH',
        entity: 'CashSession',
        entityId: id,
        payload: { reason, notes: req.body.notes },
      });
      return updated;
    });

    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: id, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sessionPayload(reopened, movements));
  } catch (error) {
    console.error(error);
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: 'Já existe um caixa aberto para este estabelecimento.',
        code: 'CASH_ALREADY_OPEN',
      });
    }
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

    const openComandas = await prisma.comanda.findMany({
      where: {
        tenantId,
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        status: true,
        total: true,
      },
    });
    if (openComandas.length > 0) {
      return res.status(409).json({
        error: 'Existem comandas abertas ou parciais. Quite ou cancele antes de fechar o caixa.',
        code: 'OPEN_COMANDAS',
        comandas: openComandas,
      });
    }

    const countedCash = req.body.countedCash != null ? Number(req.body.countedCash) : null;
    const notes = req.body.notes != null ? String(req.body.notes) : session.notes;

    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: session.id, tenantId },
    });
    const totals = summarizeSessionMovements(movements, session.openingFloat);
    const difference =
      countedCash != null ? Number(countedCash) - Number(totals.expectedCash) : null;

    const closed = await prisma.$transaction(async (tx) => {
      const closedByName = await resolveStaffName(req.user?.id, tx);
      const updated = await tx.cashSession.update({
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
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        userName: closedByName,
        action: 'CLOSE_CASH',
        entity: 'CashSession',
        entityId: session.id,
        payload: { countedCash, difference },
      });
      return updated;
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

    const description = String(req.body.description || (type === 'OUT' ? 'Sangria' : 'Suprimento'));
    const method = String(req.body.method || 'Dinheiro');

    const movement = await prisma.$transaction(async (tx) => {
      const mov = await tx.cashMovement.create({
        data: {
          tenantId,
          cashSessionId: session.id,
          type,
          source: 'ADJUSTMENT',
          amount,
          method,
          description,
          createdById: req.user?.id || null,
        },
      });
      await writeLedgerEntry(tx, {
        tenantId,
        kind: 'ADJUSTMENT',
        amount,
        direction: type,
        method,
        account: 'CAIXA',
        referenceType: 'CashMovement',
        referenceId: mov.id,
        description,
        createdById: req.user?.id || null,
      });
      await writeAuditLog(tx, {
        tenantId,
        userId: req.user?.id,
        action: type === 'OUT' ? 'CASH_ADJUSTMENT_OUT' : 'CASH_ADJUSTMENT_IN',
        entity: 'CashMovement',
        entityId: mov.id,
        payload: { amount, method, description, cashSessionId: session.id },
      });
      return mov;
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
