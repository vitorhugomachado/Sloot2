import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  BARBER_EMAIL,
  hasTestDb,
  PILOT_SLUG,
  staffLogin,
} from '../helpers/apiClient.js';

const require = createRequire(import.meta.url);
const prisma = require('../../src/lib/prisma.js');
const { generateToken, hashPassword } = require('../../src/utils/auth.js');

describe.skipIf(!hasTestDb)('Segurança / financeiro individual', () => {
  const suffix = Date.now();
  const comandaIds = [];
  const payoutIds = [];
  let tenant;
  let managerToken;
  let barber;
  let otherBarber;
  let barberToken;
  let originalPermissions;
  let cashSessionId;

  beforeAll(async () => {
    tenant = await prisma.tenant.findUnique({ where: { slug: PILOT_SLUG } });
    expect(tenant).toBeTruthy();

    const managerLogin = await staffLogin();
    managerToken = managerLogin.token;
    expect(managerToken).toBeTruthy();

    barber = await prisma.barber.findFirst({
      where: { tenantId: tenant.id, email: BARBER_EMAIL },
    });
    expect(barber).toBeTruthy();
    originalPermissions = barber.permissions;
    await prisma.barber.update({
      where: { id: barber.id },
      data: { permissions: ['dashboard', 'scheduler', 'finance'] },
    });

    otherBarber = await prisma.barber.create({
      data: {
        tenantId: tenant.id,
        name: `Outro Profissional ${suffix}`,
        email: `finance-isolation-${suffix}@test.local`,
        password: await hashPassword(`Test-${suffix}`),
        role: 'Barbeiro',
        status: 'Ativo',
        permissions: ['finance'],
      },
    });
    barberToken = generateToken({ id: barber.id, role: 'Barbeiro', tenantId: tenant.id });

    const manager = api(managerToken);
    const current = await manager.get('/api/cash/current');
    if (current.body?.session?.id) {
      cashSessionId = current.body.session.id;
    } else {
      const opened = await manager.post('/api/cash/open').send({ openingFloat: 0 });
      expect(opened.status).toBe(201);
      cashSessionId = opened.body.id;
    }

    const maxNumber = await prisma.comanda.aggregate({
      where: { tenantId: tenant.id },
      _max: { number: true },
    });
    const baseNumber = Number(maxNumber._max.number || 0) + 10;
    const closedAt = new Date();
    const own = await prisma.comanda.create({
      data: {
        tenantId: tenant.id,
        number: baseNumber,
        customerName: `Cliente do barbeiro ${suffix}`,
        status: 'QUITADA',
        total: 80,
        barberId: barber.id,
        closedAt,
        payments: { totalCheckout: 80, paidAt: closedAt.toISOString().slice(0, 10), splits: [] },
        items: {
          create: [{ itemType: 'SERVICE', name: 'Serviço próprio', quantity: 1, unitPrice: 80, total: 80, barberId: barber.id, commissionPct: 50 }],
        },
      },
    });
    const other = await prisma.comanda.create({
      data: {
        tenantId: tenant.id,
        number: baseNumber + 1,
        customerName: `Cliente de outro ${suffix}`,
        status: 'QUITADA',
        total: 120,
        barberId: otherBarber.id,
        closedAt,
        payments: { totalCheckout: 120, paidAt: closedAt.toISOString().slice(0, 10), splits: [] },
        items: {
          create: [{ itemType: 'SERVICE', name: 'Serviço alheio', quantity: 1, unitPrice: 120, total: 120, barberId: otherBarber.id, commissionPct: 60 }],
        },
      },
    });
    comandaIds.push(own.id, other.id);

    const period = closedAt.toISOString().slice(0, 10);
    const payouts = await Promise.all([
      prisma.commissionPayout.create({ data: { tenantId: tenant.id, barberId: barber.id, periodStart: period, periodEnd: period, amount: 40, method: 'Pix' } }),
      prisma.commissionPayout.create({ data: { tenantId: tenant.id, barberId: otherBarber.id, periodStart: period, periodEnd: period, amount: 72, method: 'Pix' } }),
    ]);
    payoutIds.push(...payouts.map((payout) => payout.id));
  });

  afterAll(async () => {
    if (comandaIds.length) {
      await prisma.comandaPayment.deleteMany({ where: { comandaId: { in: comandaIds } } }).catch(() => {});
      await prisma.cashMovement.deleteMany({ where: { referenceType: 'Comanda', referenceId: { in: comandaIds } } }).catch(() => {});
      await prisma.comandaItem.deleteMany({ where: { comandaId: { in: comandaIds } } }).catch(() => {});
      await prisma.comanda.deleteMany({ where: { id: { in: comandaIds } } }).catch(() => {});
    }
    if (payoutIds.length) await prisma.commissionPayout.deleteMany({ where: { id: { in: payoutIds } } }).catch(() => {});
    if (otherBarber?.id) await prisma.barber.deleteMany({ where: { id: otherBarber.id } }).catch(() => {});
    if (barber?.id) await prisma.barber.update({ where: { id: barber.id }, data: { permissions: originalPermissions } }).catch(() => {});
  });

  it('ignora barberId da query e retorna apenas comissão e repasses próprios', async () => {
    const client = api(barberToken);
    const commissions = await client.get(`/api/finance-v2/commissions?barberId=${otherBarber.id}`);
    expect(commissions.status).toBe(200);
    expect(commissions.body.rows.some((row) => row.barberId === otherBarber.id)).toBe(false);
    expect(commissions.body.rows.some((row) => row.barberId === barber.id)).toBe(true);

    const payouts = await client.get(`/api/finance-v2/commissions/payouts?barberId=${otherBarber.id}`);
    expect(payouts.status).toBe(200);
    expect(payouts.body.every((payout) => payout.barberId === barber.id)).toBe(true);
  });

  it.each([
    '/api/finance-v2/ledger',
    '/api/finance-v2/expenses',
    '/api/finance-v2/cash-flow?startMonth=2026-01',
    '/api/finance-v2/accounts/balances',
    '/api/finance-v2/closings',
    '/api/finance-v2/dre?month=2026-01',
    '/api/finance-v2/audit',
    '/api/finance-v2/kpis',
  ])('bloqueia endpoint financeiro consolidado %s', async (path) => {
    const res = await api(barberToken).get(path);
    expect(res.status).toBe(403);
  });

  it('lista e abre somente comandas vinculadas ao próprio barbeiro', async () => {
    const client = api(barberToken);
    const list = await client.get('/api/comandas?status=QUITADA');
    expect(list.status).toBe(200);
    expect(list.body.some((row) => row.barberId === otherBarber.id)).toBe(false);

    const own = await client.get(`/api/comandas/${comandaIds[0]}`);
    expect(own.status).toBe(200);
    const other = await client.get(`/api/comandas/${comandaIds[1]}`);
    expect(other.status).toBe(404);
    const settleOther = await client.post(`/api/comandas/${comandaIds[1]}/settle`).send({
      cashSessionId,
      payments: { splits: [{ method: 'Pix', amount: 120 }] },
    });
    expect(settleOther.status).toBe(404);
  });

  it('recebe comanda própria com caixa sanitizado, sem expor totais', async () => {
    const client = api(barberToken);
    const current = await client.get('/api/cash/current');
    expect(current.status).toBe(200);
    expect(current.body.session).toEqual({
      id: cashSessionId,
      status: 'OPEN',
      openedAt: expect.any(String),
    });
    expect(current.body.session.totals).toBeUndefined();
    expect(current.body.session.openingFloat).toBeUndefined();

    const sessions = await client.get('/api/cash/sessions');
    expect(sessions.status).toBe(200);
    expect(sessions.body).toEqual([current.body.session]);
    const detail = await client.get(`/api/cash/sessions/${cashSessionId}`);
    expect(detail.status).toBe(403);

    const created = await client.post('/api/comandas').send({
      customerName: `Checkout próprio ${suffix}`,
      barberId: otherBarber.id,
      items: [{ itemType: 'SERVICE', name: 'Checkout próprio', quantity: 1, unitPrice: 25, barberId: otherBarber.id }],
    });
    expect(created.status).toBe(201);
    expect(created.body.barberId).toBe(barber.id);
    expect(created.body.items.every((item) => item.barberId === barber.id)).toBe(true);
    comandaIds.push(created.body.id);

    const settled = await client.post(`/api/comandas/${created.body.id}/settle`).send({
      cashSessionId,
      payments: { splits: [{ method: 'Pix', amount: 25 }] },
    });
    expect(settled.status).toBe(200);
    expect(settled.body.status).toBe('QUITADA');
  });

  it('mantém a visão consolidada e o filtro por profissional para o gerente', async () => {
    const client = api(managerToken);
    const ledger = await client.get('/api/finance-v2/ledger');
    expect(ledger.status).toBe(200);

    const commissions = await client.get(`/api/finance-v2/commissions?barberId=${otherBarber.id}`);
    expect(commissions.status).toBe(200);
    expect(commissions.body.rows.some((row) => row.barberId === otherBarber.id)).toBe(true);
    expect(commissions.body.rows.some((row) => row.barberId === barber.id)).toBe(false);
  });
});
