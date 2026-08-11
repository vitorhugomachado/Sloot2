import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, hasTestDb, PILOT_SLUG, staffLogin } from '../helpers/apiClient.js';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureOpenCash(client) {
  const current = await client.get('/api/cash/current');
  if (current.body?.session?.id) {
    return current.body.session;
  }
  const opened = await client.post('/api/cash/open').send({ openingFloat: 0 });
  expect(opened.status).toBe(201);
  return opened.body;
}

async function clearBlockingComandas(client) {
  for (const status of ['OPEN', 'PARTIAL']) {
    const listRes = await client.get(`/api/comandas?status=${status}`);
    expect(listRes.status).toBe(200);
    const list = Array.isArray(listRes.body) ? listRes.body : [];
    for (const c of list) {
      const st = String(c.status || '').toUpperCase();
      if (st === 'PARTIAL') {
        const reverseRes = await client.post(`/api/comandas/${c.id}/reverse`).send({});
        expect(reverseRes.status).toBe(200);
      }
      const cancelRes = await client.post(`/api/comandas/${c.id}/cancel`).send({});
      expect(cancelRes.status).toBe(200);
    }
  }
}

describe.skipIf(!hasTestDb)('API finance — caixa e comandas', () => {
  let token;
  let tenantId;
  let cashSessionId;
  const suffix = Date.now();
  const cleanupComandaIds = [];
  let closingId = null;

  beforeAll(async () => {
    const login = await staffLogin();
    expect(login.token).toBeTruthy();
    token = login.token;

    const tenant = await prisma.tenant.findUnique({ where: { slug: PILOT_SLUG } });
    expect(tenant).toBeTruthy();
    tenantId = tenant.id;

    const client = api(token);
    const session = await ensureOpenCash(client);
    cashSessionId = session.id;
  });

  afterAll(async () => {
    if (closingId) {
      await prisma.financeClosing.deleteMany({ where: { id: closingId, tenantId } }).catch(() => {});
    }
    if (cleanupComandaIds.length) {
      await prisma.comandaPayment.deleteMany({
        where: { comandaId: { in: cleanupComandaIds }, tenantId },
      }).catch(() => {});
      await prisma.cashMovement.deleteMany({
        where: { referenceType: 'Comanda', referenceId: { in: cleanupComandaIds }, tenantId },
      }).catch(() => {});
      await prisma.comandaItem.deleteMany({
        where: { comandaId: { in: cleanupComandaIds } },
      }).catch(() => {});
      await prisma.comanda.deleteMany({
        where: { id: { in: cleanupComandaIds }, tenantId },
      }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('pagamento parcial não duplica movimentos ao completar saldo', async () => {
    const client = api(token);
    const createRes = await client.post('/api/comandas').send({
      customerName: `Partial Test ${suffix}`,
      items: [{ itemType: 'SERVICE', name: 'Corte teste', quantity: 1, unitPrice: 100, total: 100 }],
      total: 100,
    });
    expect(createRes.status).toBe(201);
    const comandaId = createRes.body.id;
    cleanupComandaIds.push(comandaId);

    const partial1 = await client.post(`/api/comandas/${comandaId}/settle`).send({
      cashSessionId,
      allowPartial: true,
      payments: {
        splits: [{ method: 'Pix', amount: 40 }],
      },
    });
    expect(partial1.status).toBe(200);
    expect(partial1.body.status).toBe('PARTIAL');

    const partial2 = await client.post(`/api/comandas/${comandaId}/settle`).send({
      cashSessionId,
      payments: {
        splits: [{ method: 'Dinheiro', amount: 60 }],
      },
    });
    expect(partial2.status).toBe(200);
    expect(partial2.body.status).toBe('QUITADA');

    const payments = await prisma.comandaPayment.findMany({
      where: { tenantId, comandaId },
      orderBy: { id: 'asc' },
    });
    expect(payments).toHaveLength(2);
    const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    expect(paidTotal).toBeCloseTo(100, 2);

    const movements = await prisma.cashMovement.findMany({
      where: {
        tenantId,
        referenceType: 'Comanda',
        referenceId: comandaId,
        source: 'COMANDA',
        type: 'IN',
      },
    });
    expect(movements).toHaveLength(2);
  });

  it('bloqueia fechamento de caixa com comanda OPEN sem vínculo de sessão', async () => {
    const client = api(token);
    const createRes = await client.post('/api/comandas').send({
      customerName: `Open Block ${suffix}`,
      items: [{ itemType: 'SERVICE', name: 'Serviço', quantity: 1, unitPrice: 50, total: 50 }],
      total: 50,
    });
    expect(createRes.status).toBe(201);
    cleanupComandaIds.push(createRes.body.id);
    expect(createRes.body.cashSessionId).toBeNull();

    const closeRes = await client.post('/api/cash/close').send({ countedCash: 0 });
    expect(closeRes.status).toBe(409);
    expect(closeRes.body.code).toBe('OPEN_COMANDAS');
    expect(Array.isArray(closeRes.body.comandas)).toBe(true);
    expect(closeRes.body.comandas.some((c) => c.id === createRes.body.id)).toBe(true);
  });

  it('ignora force=true e mantém bloqueio com comanda OPEN', async () => {
    const client = api(token);
    const createRes = await client.post('/api/comandas').send({
      customerName: `Force Block ${suffix}`,
      items: [{ itemType: 'SERVICE', name: 'Serviço', quantity: 1, unitPrice: 55, total: 55 }],
      total: 55,
    });
    expect(createRes.status).toBe(201);
    cleanupComandaIds.push(createRes.body.id);

    const closeRes = await client.post('/api/cash/close').send({ countedCash: 0, force: true });
    expect(closeRes.status).toBe(409);
    expect(closeRes.body.code).toBe('OPEN_COMANDAS');

    const cancelRes = await client.post(`/api/comandas/${createRes.body.id}/cancel`).send({});
    expect(cancelRes.status).toBe(200);
  });

  it('bloqueia quitação quando período contábil está fechado', async () => {
    const client = api(token);
    const day = todayIso();

    const closingRes = await client.post('/api/finance-v2/closings').send({
      periodStart: day,
      periodEnd: day,
      notes: `test ${suffix}`,
    });
    expect(closingRes.status).toBe(201);
    closingId = closingRes.body.id;

    const createRes = await client.post('/api/comandas').send({
      customerName: `Period Closed ${suffix}`,
      items: [{ itemType: 'SERVICE', name: 'Serviço', quantity: 1, unitPrice: 30, total: 30 }],
      total: 30,
    });
    expect(createRes.status).toBe(201);
    cleanupComandaIds.push(createRes.body.id);

    const settleRes = await client.post(`/api/comandas/${createRes.body.id}/settle`).send({
      cashSessionId,
      payments: {
        splits: [{ method: 'Pix', amount: 30 }],
      },
    });
    expect(settleRes.status).toBe(409);
    expect(settleRes.body.code).toBe('PERIOD_CLOSED');

    await prisma.financeClosing.deleteMany({ where: { id: closingId, tenantId } });
    closingId = null;
  });

  it('estorna comanda quitada', async () => {
    const client = api(token);
    const createRes = await client.post('/api/comandas').send({
      customerName: `Reverse Test ${suffix}`,
      items: [{ itemType: 'SERVICE', name: 'Serviço', quantity: 1, unitPrice: 45, total: 45 }],
      total: 45,
    });
    expect(createRes.status).toBe(201);
    const comandaId = createRes.body.id;
    cleanupComandaIds.push(comandaId);

    const settleRes = await client.post(`/api/comandas/${comandaId}/settle`).send({
      cashSessionId,
      payments: { splits: [{ method: 'Pix', amount: 45 }] },
    });
    expect(settleRes.status).toBe(200);
    expect(settleRes.body.status).toBe('QUITADA');

    const reverseRes = await client.post(`/api/comandas/${comandaId}/reverse`).send({});
    expect(reverseRes.status).toBe(200);
    expect(String(reverseRes.body.status).toUpperCase()).toBe('OPEN');
  });

  it('cancela comanda aberta sem pagamentos', async () => {
    const client = api(token);
    const createRes = await client.post('/api/comandas').send({
      customerName: `Cancel Test ${suffix}`,
      items: [{ itemType: 'SERVICE', name: 'Serviço', quantity: 1, unitPrice: 35, total: 35 }],
      total: 35,
    });
    expect(createRes.status).toBe(201);
    cleanupComandaIds.push(createRes.body.id);

    const cancelRes = await client.post(`/api/comandas/${createRes.body.id}/cancel`).send({});
    expect(cancelRes.status).toBe(200);
    expect(String(cancelRes.body.status).toUpperCase()).toBe('CANCELLED');
  });

  it('reabre caixa fechado com motivo', async () => {
    const client = api(token);
    const closedId = cashSessionId;
    await clearBlockingComandas(client);
    const closeRes = await client.post('/api/cash/close').send({ countedCash: 0 });
    expect(closeRes.status).toBe(200);

    const reopenRes = await client.post(`/api/cash/sessions/${closedId}/reopen`).send({
      reason: `Teste reopen ${suffix}`,
    });
    expect(reopenRes.status).toBe(200);
    expect(String(reopenRes.body.status).toUpperCase()).toBe('OPEN');

    const current = await client.get('/api/cash/current');
    expect(current.body?.session?.id).toBe(closedId);
    cashSessionId = closedId;
  });

  it('impede dois caixas abertos simultâneos', async () => {
    const client = api(token);
    await clearBlockingComandas(client);
    await client.post('/api/cash/close').send({ countedCash: 0 });

    const [first, second] = await Promise.all([
      client.post('/api/cash/open').send({ openingFloat: 0 }),
      client.post('/api/cash/open').send({ openingFloat: 0 }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const session = await ensureOpenCash(client);
    cashSessionId = session.id;
  });
});
