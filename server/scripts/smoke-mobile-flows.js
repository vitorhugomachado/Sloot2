/**
 * Smoke test dos fluxos críticos no mobile staff (API).
 * Valida: reserva manual, agenda, CRM e ações de agendamento.
 *
 * Uso:
 *   node scripts/smoke-mobile-flows.js
 *   PILOT_SLUG=slooti-piloto node scripts/smoke-mobile-flows.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');

const BASE = process.env.API_BASE || 'http://localhost:3001/api';
const PILOT_SLUG = (process.env.PILOT_SLUG || 'slooti-piloto').trim().toLowerCase();
const MANAGER_EMAIL = process.env.PILOT_MANAGER_EMAIL || 'gerente@slooti-piloto.test';
const MANAGER_PASSWORD = process.env.PILOT_MANAGER_PASSWORD || 'SlootiPiloto123';

const prisma = new PrismaClient();

async function request(method, path, { token, body, slug } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': slug || PILOT_SLUG,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function assertStatus(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual} — ${JSON.stringify(actual)}`);
  }
  console.log(`OK ${label} (${actual})`);
}

function assertTruthy(label, value) {
  if (!value) throw new Error(`${label}: expected truthy value`);
  console.log(`OK ${label}`);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: PILOT_SLUG } });
  if (!tenant) {
    throw new Error(`Tenant "${PILOT_SLUG}" não encontrado. Rode: node scripts/seed_pilot_tenant.js`);
  }

  const login = await request('POST', '/auth/login', {
    slug: PILOT_SLUG,
    body: { email: MANAGER_EMAIL, password: MANAGER_PASSWORD },
  });
  assertStatus('POST /auth/login (gerente piloto)', login.status, 200);
  const staffToken = login.data?.token;
  assertTruthy('staff token', staffToken);

  const suffix = Date.now();
  const clientPhone = `5511976${String(suffix).slice(-7)}`;
  const clientName = `Mobile Smoke ${suffix}`;

  const createClient = await request('POST', '/clients', {
    token: staffToken,
    body: { name: clientName, phone: clientPhone },
  });
  assertStatus('POST /clients (CRM — novo cliente)', createClient.status, 201);

  const listClients = await request('GET', '/clients?page=1&pageSize=10&search=' + encodeURIComponent(clientName), {
    token: staffToken,
  });
  assertStatus('GET /clients (CRM — listagem)', listClients.status, 200);
  const foundClient = Array.isArray(listClients.data?.items)
    ? listClients.data.items.find((c) => c.phone === clientPhone)
    : null;
  assertTruthy('cliente encontrado na listagem', foundClient);

  const service = await prisma.service.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, price: true },
  });
  const barber = await prisma.barber.findFirst({
    where: { tenantId: tenant.id, role: 'Barbeiro', deletedAt: null, status: 'Ativo' },
    select: { id: true },
  });
  if (!service || !barber) {
    throw new Error('Piloto precisa de ao menos 1 serviço e 1 barbeiro ativo');
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);

  const createAppt = await request('POST', '/appointments', {
    token: staffToken,
    body: {
      customer: clientName,
      phone: clientPhone,
      service: service.name,
      barberId: barber.id,
      date,
      time: '11:00',
      price: service.price,
    },
  });
  assertStatus('POST /appointments (reserva manual)', createAppt.status, 201);
  const apptId = createAppt.data?.id;
  assertTruthy('appointment id', apptId);

  const listAppts = await request('GET', `/appointments?from=${date}&to=${date}`, { token: staffToken });
  assertStatus('GET /appointments (agenda do dia)', listAppts.status, 200);
  const listed = Array.isArray(listAppts.data)
    ? listAppts.data.find((a) => Number(a.id) === Number(apptId))
    : null;
  assertTruthy('agendamento visível na agenda', listed);

  const startAppt = await request('PATCH', `/appointments/${apptId}`, {
    token: staffToken,
    body: { status: 'Em atendimento' },
  });
  assertStatus('PATCH /appointments (iniciar atendimento)', startAppt.status, 200);

  const finishAppt = await request('PATCH', `/appointments/${apptId}`, {
    token: staffToken,
    body: { status: 'Finalizado' },
  });
  assertStatus('PATCH /appointments (finalizar)', finishAppt.status, 200);

  const cancelAppt = await request('POST', '/appointments', {
    token: staffToken,
    body: {
      customer: `Cancel Test ${suffix}`,
      phone: `5511965${String(suffix).slice(-7)}`,
      service: service.name,
      barberId: barber.id,
      date,
      time: '15:00',
      price: service.price,
    },
  });
  assertStatus('POST /appointments (para cancelar)', cancelAppt.status, 201);
  const cancelId = cancelAppt.data?.id;

  const cancelPatch = await request('PATCH', `/appointments/${cancelId}`, {
    token: staffToken,
    body: { status: 'Cancelado' },
  });
  assertStatus('PATCH /appointments (cancelar)', cancelPatch.status, 200);

  console.log('\nMobile smoke flows passed for tenant:', PILOT_SLUG);
  console.log('Checklist UI (viewport ≤768px):');
  console.log('  [ ] /' + PILOT_SLUG + '/dashboard/scheduler — reserva manual com nome+telefone');
  console.log('  [ ] Agenda do dia — iniciar / concluir / cancelar');
  console.log('  [ ] /' + PILOT_SLUG + '/dashboard/clients — buscar e abrir ficha');
  console.log('  [ ] Sidebar — abas respeitam módulos do tenant');
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
