import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { api, hasTestDb, PILOT_SLUG, staffLogin } from '../helpers/apiClient.js';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findFreePilotSlot(tenantId, barberId) {
  const times = ['14:00', '15:00', '16:00', '17:00'];
  for (let offset = 1; offset <= 30; offset += 1) {
    const dateValue = new Date();
    dateValue.setDate(dateValue.getDate() + offset);
    if (dateValue.getDay() === 0) continue;
    const date = dateValue.toISOString().slice(0, 10);
    const occupied = await prisma.appointment.findMany({
      where: { tenantId, barberId, date, status: { in: ['Agendado', 'Confirmado', 'Em progresso'] } },
      select: { time: true },
    });
    const occupiedTimes = new Set(occupied.map((item) => String(item.time).slice(0, 5)));
    const time = times.find((candidate) => !occupiedTimes.has(candidate));
    if (time) return { date, time };
  }
  throw new Error('Nenhum horário livre encontrado para o teste.');
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
    const { date, time } = await findFreePilotSlot(tenant.id, barber.id);
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
      time,
      price: service.price,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body?.id).toBeTruthy();

    const listAfter = await client.get(`/api/appointments?from=${date}&to=${date}`);
    expect(listAfter.status).toBe(200);
    expect(
      listAfter.body.some((a) => Number(a.id) === Number(createRes.body.id))
    ).toBe(true);
    await prisma.appointment.delete({ where: { id: createRes.body.id } });
  });

  it('duas confirmações simultâneas criam uma única reserva', async () => {
    const login = await staffLogin();
    const tenant = await prisma.tenant.findUnique({ where: { slug: PILOT_SLUG } });
    const service = await prisma.service.findFirst({
      where: { tenantId: tenant.id },
      select: { name: true, price: true },
    });
    const barber = await prisma.barber.findFirst({
      where: { tenantId: tenant.id, role: 'Barbeiro', deletedAt: null, status: 'Ativo' },
      select: { id: true },
    });
    const { date, time } = await findFreePilotSlot(tenant.id, barber.id);
    const payload = {
      customer: `Corrida ${Date.now()}`,
      phone: '5511999999999',
      service: service.name,
      barberId: barber.id,
      date,
      time,
      price: service.price,
    };
    const client = api(login.token);
    const responses = await Promise.all([
      client.post('/api/appointments').send(payload),
      client.post('/api/appointments').send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409)?.body).toMatchObject({
      code: 'SLOT_TAKEN',
    });
    const created = responses.find((response) => response.status === 201)?.body;
    await prisma.appointment.delete({ where: { id: created.id } });
  });

  it('rejeita horário que sobrepõe a duração de outra reserva', async () => {
    const login = await staffLogin();
    const tenant = await prisma.tenant.findUnique({ where: { slug: PILOT_SLUG } });
    const service = await prisma.service.findFirst({
      where: { tenantId: tenant.id, duration: { not: '0 min' } },
      select: { name: true, price: true },
    });
    const barber = await prisma.barber.findFirst({
      where: { tenantId: tenant.id, role: 'Barbeiro', deletedAt: null, status: 'Ativo' },
      select: { id: true },
    });
    const { date, time } = await findFreePilotSlot(tenant.id, barber.id);
    const [hour, minute] = time.split(':').map(Number);
    const overlappingTime = `${String(hour).padStart(2, '0')}:${String(minute + 10).padStart(2, '0')}`;
    const client = api(login.token);
    const payload = {
      customer: `Sobreposição ${Date.now()}`,
      phone: '5511888888888',
      service: service.name,
      barberId: barber.id,
      date,
      time,
      price: service.price,
    };
    const first = await client.post('/api/appointments').send(payload);
    expect(first.status).toBe(201);

    const overlap = await client.post('/api/appointments').send({ ...payload, time: overlappingTime });
    expect(overlap.status).toBe(409);
    expect(overlap.body?.code).toBe('SLOT_TAKEN');
    await prisma.appointment.delete({ where: { id: first.body.id } });
  });
});
