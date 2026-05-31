/**
 * Cria 70 agendamentos nos próximos 7 dias, repartidos entre 4 barbeiros ativos.
 *
 * Uso (na pasta server):
 *   node scripts/seed_next_7_days_appointments.js
 *   node scripts/seed_next_7_days_appointments.js --slug=two-brothers
 *   node scripts/seed_next_7_days_appointments.js --count=70 --days=7 --barbers=4
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { clientAt } = require('./lib/realClientNames');

const prisma = new PrismaClient();

const TOTAL = Number(process.argv.find((a) => a.startsWith('--count='))?.split('=')[1] || 70);
const DAYS = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] || 7);
const BARBER_COUNT = Number(process.argv.find((a) => a.startsWith('--barbers='))?.split('=')[1] || 4);
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const slug = (slugArg ? slugArg.split('=')[1] : process.env.DEFAULT_TENANT_SLUG || 'two-brothers')
  .trim()
  .toLowerCase();

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
];

const STATUSES = ['Agendado', 'Agendado', 'Confirmado', 'Agendado', 'Em progresso'];

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function enumerateDates(fromDate, count) {
  const dates = [];
  const cursor = new Date(fromDate);
  for (let i = 0; i < count; i += 1) {
    dates.push(toYMD(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

async function loadTakenSlots(tenantId, dates, barberIds) {
  const existing = await prisma.appointment.findMany({
    where: {
      tenantId,
      date: { in: dates },
      barberId: { in: barberIds },
      status: { not: 'Cancelado' },
    },
    select: { barberId: true, date: true, time: true },
  });
  const taken = new Set();
  for (const row of existing) {
    taken.add(`${row.barberId}|${row.date}|${row.time}`);
  }
  return taken;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant "${slug}" não encontrado.`);
    process.exit(1);
  }

  const barbers = await prisma.barber.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: 'Ativo',
      role: 'Barbeiro',
    },
    orderBy: { id: 'asc' },
    take: BARBER_COUNT,
  });

  if (barbers.length < BARBER_COUNT) {
    console.error(
      `Esperados ${BARBER_COUNT} barbeiros ativos; encontrados ${barbers.length} no tenant "${slug}".`,
    );
    console.error('Barbeiros:', barbers.map((b) => `${b.id}: ${b.name}`).join(' | ') || '(nenhum)');
    process.exit(1);
  }

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id },
    orderBy: { id: 'asc' },
  });
  if (!services.length) {
    console.error('Nenhum serviço cadastrado neste tenant.');
    process.exit(1);
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dates = enumerateDates(today, DAYS);
  const barberIds = barbers.map((b) => b.id);
  const taken = await loadTakenSlots(tenant.id, dates, barberIds);

  const rows = [];
  let clientSeq = 0;
  let barberIdx = 0;
  let timeIdx = 0;
  let created = 0;

  for (let day = 0; day < DAYS && created < TOTAL; day += 1) {
    const date = dates[day];
    const perDay = Math.ceil((TOTAL - created) / (DAYS - day));

    for (let i = 0; i < perDay && created < TOTAL; i += 1) {
      let placed = false;
      for (let attempt = 0; attempt < barbers.length * TIME_SLOTS.length && !placed; attempt += 1) {
        const barber = barbers[barberIdx % barbers.length];
        const time = TIME_SLOTS[timeIdx % TIME_SLOTS.length];
        barberIdx += 1;
        timeIdx += 1;

        const key = `${barber.id}|${date}|${time}`;
        if (taken.has(key)) continue;

        const svc = services[created % services.length];
        const client = clientAt(clientSeq++, '44');
        rows.push({
          tenantId: tenant.id,
          customer: client.name,
          phone: client.phone,
          service: svc.name,
          barberId: barber.id,
          date,
          time,
          status: STATUSES[created % STATUSES.length],
          price: svc.price,
        });
        taken.add(key);
        created += 1;
        placed = true;
      }

      if (!placed) {
        console.warn(`Sem horário livre em ${date}; criados ${created}/${TOTAL}.`);
        break;
      }
    }
  }

  if (!rows.length) {
    console.error('Nenhum agendamento criado (grade cheia ou conflitos).');
    process.exit(1);
  }

  const result = await prisma.appointment.createMany({ data: rows });

  const byBarber = {};
  for (const b of barbers) byBarber[b.id] = { name: b.name, count: 0 };
  for (const row of rows) byBarber[row.barberId].count += 1;

  console.log(`\nTenant: ${tenant.name} (${slug})`);
  console.log(`Criados ${result.count} agendamentos (${dates[0]} → ${dates[dates.length - 1]}).\n`);
  for (const b of barbers) {
    console.log(`  ${b.name} (id ${b.id}): ${byBarber[b.id].count} agendamentos`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
