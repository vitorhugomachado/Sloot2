import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { api, hasTestDb, PILOT_SLUG, staffLogin } from '../helpers/apiClient.js';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!hasTestDb)('API /appointments', () => {
  it('lista e cria agendamento', async () => {
    const login = await staffLogin();
    expect(login.token).toBeTruthy();

    const tenant = await prisma.tenant.findUnique({ where: { slug: PILOT_SLUG } });
    expect(tenant).toBeTruthy();

    const service = await prisma.service.findFirst({
      where: { tenantId: tenant.id },
      select: { name: true, price: true },
    });
    const barber = await prisma.barber.findFirst({
      where: { tenantId: tenant.id, role: 'Barbeiro', deletedAt: null, status: 'Ativo' },
      select: { id: true },
    });
    expect(service).toBeTruthy();
    expect(barber).toBeTruthy();

    const suffix = Date.now();
    const date = tomorrowIso();
    const client = api(login.token);

    const listBefore = await client.get(`/api/appointments?from=${date}&to=${date}`);
    expect(listBefore.status).toBe(200);
    expect(Array.isArray(listBefore.body)).toBe(true);

    const createRes = await client.post('/api/appointments').send({
      customer: `Api Test ${suffix}`,
      phone: `5511965${String(suffix).slice(-7)}`,
      service: service.name,
      barberId: barber.id,
      date,
      time: '14:00',
      price: service.price,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body?.id).toBeTruthy();

    const listAfter = await client.get(`/api/appointments?from=${date}&to=${date}`);
    expect(listAfter.status).toBe(200);
    expect(
      listAfter.body.some((a) => Number(a.id) === Number(createRes.body.id))
    ).toBe(true);
  });
});
