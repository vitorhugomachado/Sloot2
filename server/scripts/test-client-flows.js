/**
 * Smoke tests: POST /clients, customer register, appointments, listagens.
 * Run with API up: node scripts/test-client-flows.js
 */
const { PrismaClient } = require('@prisma/client');

const BASE = process.env.API_BASE || 'http://localhost:3001/api';
const prisma = new PrismaClient();

async function request(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
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

async function main() {
  const gerente = await prisma.barber.findFirst({
    where: { role: 'Gerente', deletedAt: null },
    select: { email: true },
  });
  if (!gerente?.email) {
    throw new Error('No Gerente barber in database for staff login');
  }

  const loginAttempts = [
    { email: 'admin@admin.com', password: 'admin' },
    { email: gerente.email, password: '123' },
    { email: gerente.email, password: 'admin' },
  ];
  let staffToken;
  for (const cred of loginAttempts) {
    const staffLogin = await request('POST', '/auth/login', { body: cred });
    if (staffLogin.status === 200 && staffLogin.data?.token) {
      staffToken = staffLogin.data.token;
      break;
    }
  }
  if (!staffToken) {
    throw new Error('Staff login failed for Gerente account');
  }

  const suffix = Date.now();
  const clientPhone = `5511999${String(suffix).slice(-7)}`;
  const clientEmail = `test.client.${suffix}@example.com`;

  const createClient = await request('POST', '/clients', {
    token: staffToken,
    body: { name: `Test Client ${suffix}`, phone: clientPhone, email: clientEmail },
  });
  assertStatus('POST /clients', createClient.status, 201);

  const registerEmail = `register.${suffix}@example.com`;
  const register = await request('POST', '/customer-auth/register', {
    body: {
      name: 'Register Test',
      email: registerEmail,
      password: 'TestPass123!',
      phone: `5521888${String(suffix).slice(-7)}`,
    },
  });
  assertStatus('POST /customer-auth/register', register.status, 201);

  const service = await prisma.service.findFirst({ select: { id: true, name: true, price: true } });
  const barber = await prisma.barber.findFirst({
    where: { role: 'Barbeiro', deletedAt: null, status: 'Ativo' },
    select: { id: true },
  });
  if (!service || !barber) {
    throw new Error('Need at least one service and active barber for appointment test');
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);

  const createAppt = await request('POST', '/appointments', {
    body: {
      customer: 'Walk-in Test',
      phone: clientPhone,
      service: service.name,
      barberId: barber.id,
      date,
      time: '10:30',
      price: service.price,
    },
  });
  assertStatus('POST /appointments', createAppt.status, 201);

  const listClients = await request('GET', '/clients?page=1&pageSize=5', { token: staffToken });
  assertStatus('GET /clients', listClients.status, 200);

  const listAppts = await request('GET', '/appointments', { token: staffToken });
  assertStatus('GET /appointments', listAppts.status, 200);

  const tenantCol = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Customer'
      AND column_name = 'tenantId'
  `;
  if (tenantCol.length > 0) {
    throw new Error('Customer.tenantId column still exists in database');
  }
  console.log('OK Customer.tenantId column absent');

  const tenantTable = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Tenant'
  `;
  if (tenantTable.length > 0) {
    throw new Error('Tenant table still exists');
  }
  console.log('OK Tenant table absent');

  console.log('\nAll client-flow smoke tests passed.');
}

main()
  .catch((e) => {
    console.error('\nFAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
