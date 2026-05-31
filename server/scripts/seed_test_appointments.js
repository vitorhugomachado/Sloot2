/**
 * Cria 5 agendamentos de teste para cada barbeiro ativo (role Barbeiro).
 * Uso: na pasta server → node scripts/seed_test_appointments.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { clientAt } = require('./lib/realClientNames');

const prisma = new PrismaClient();

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TIME_SLOTS = ['09:00', '10:30', '14:00', '15:30', '11:00'];
const DAY_OFFSETS = [1, 2, 3, 5, 8];

async function main() {
  const slug = String(process.env.DEFAULT_TENANT_SLUG || 'two-brothers').trim().toLowerCase();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant "${slug}" não encontrado.`);
    process.exit(1);
  }

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id },
    orderBy: { id: 'asc' },
  });
  if (!services.length) {
    console.error('Nenhum serviço no banco. Rode o seed ou cadastre serviços antes.');
    process.exit(1);
  }

  let barbers = await prisma.barber.findMany({
    where: { tenantId: tenant.id, deletedAt: null, status: 'Ativo', role: 'Barbeiro' },
    orderBy: { id: 'asc' },
  });

  if (!barbers.length) {
    barbers = await prisma.barber.findMany({
      where: { tenantId: tenant.id, deletedAt: null, status: 'Ativo' },
      orderBy: { id: 'asc' },
    });
    console.warn('Nenhum usuário com role Barbeiro; usando todos os barbeiros ativos.');
  }

  if (!barbers.length) {
    console.error('Nenhum barbeiro ativo encontrado.');
    process.exit(1);
  }

  const base = new Date();
  const rows = [];
  let n = 0;

  for (const barber of barbers) {
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + DAY_OFFSETS[i]);
      const svc = services[i % services.length];
      const client = clientAt(n);
      rows.push({
        tenantId: tenant.id,
        customer: client.name,
        phone: client.phone,
        service: svc.name,
        barberId: barber.id,
        date: toYMD(d),
        time: TIME_SLOTS[i],
        status: i === 0 ? 'Confirmado' : 'Agendado',
        price: svc.price,
      });
      n += 1;
    }
  }

  const result = await prisma.appointment.createMany({ data: rows });
  console.log(`Criados ${result.count} agendamentos para ${barbers.length} profissional(is).`);
  barbers.forEach((b) => console.log(`  - ${b.name} (id ${b.id}): 5 agendamentos`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
