/**
 * Preenche ~90% da agenda de todos os barbeiros ativos em uma data (padrão: 2026-06-02).
 * Clientes com nomes reais (realClientNames).
 *
 * Uso (na pasta server):
 *   node scripts/seed_june02_90pct.js
 *   node scripts/seed_june02_90pct.js --date=2026-06-02 --occupancy=0.9
 *   node scripts/seed_june02_90pct.js --slug=two-brothers
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { clientAt } = require('./lib/realClientNames');
const {
  getShiftCapacitySlotsForDay,
  normalizeBookingTime,
} = require('./lib/scheduleCapacity');

const prisma = new PrismaClient();

const dateArg = process.argv.find((a) => a.startsWith('--date='));
const TARGET_DATE = (dateArg ? dateArg.split('=')[1] : '2026-06-02').trim();

const occArg = process.argv.find((a) => a.startsWith('--occupancy='));
const OCCUPANCY_TARGET = Math.min(
  1,
  Math.max(0, Number(occArg ? occArg.split('=')[1] : 0.9) || 0.9),
);

const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const slug = (slugArg ? slugArg.split('=')[1] : process.env.DEFAULT_TENANT_SLUG || 'two-brothers')
  .trim()
  .toLowerCase();

const STATUSES = ['Agendado', 'Agendado', 'Confirmado', 'Agendado', 'Confirmado'];

/** Data de referência para não filtrar slots no passado (dia alvo no meio-dia). */
const REFERENCE_NOW = new Date(`${TARGET_DATE}T12:00:00`);

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
    include: {
      shifts: true,
      scheduleBlocks: true,
    },
  });

  if (!barbers.length) {
    console.error(`Nenhum barbeiro ativo no tenant "${slug}".`);
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

  const defaultService = services[0];
  const durationMinutes = 30;

  const barberIds = barbers.map((b) => b.id);
  const existing = await prisma.appointment.findMany({
    where: {
      tenantId: tenant.id,
      date: TARGET_DATE,
      barberId: { in: barberIds },
      status: { not: 'Cancelado' },
    },
    select: { barberId: true, time: true },
  });

  const takenByBarber = new Map();
  for (const b of barbers) takenByBarber.set(b.id, new Set());
  for (const row of existing) {
    const t = normalizeBookingTime(row.time);
    if (t) takenByBarber.get(row.barberId)?.add(t);
  }

  const rows = [];
  let clientSeq = 0;
  const summary = [];

  for (const barber of barbers) {
    const capacitySlots = getShiftCapacitySlotsForDay(
      barber,
      TARGET_DATE,
      durationMinutes,
      REFERENCE_NOW,
    );
    const capacity = capacitySlots.length;
    const taken = takenByBarber.get(barber.id) || new Set();
    const occupied = capacitySlots.filter((slot) => taken.has(slot)).length;
    const target = capacity > 0 ? Math.round(capacity * OCCUPANCY_TARGET) : 0;
    const toCreate = Math.max(0, target - occupied);

    const freeSlots = capacitySlots.filter((slot) => !taken.has(slot));
    let created = 0;

    for (let i = 0; i < toCreate && i < freeSlots.length; i += 1) {
      const time = freeSlots[i];
      const svc = services[(clientSeq + i) % services.length];
      const client = clientAt(clientSeq++, '44');
      rows.push({
        tenantId: tenant.id,
        customer: client.name,
        phone: client.phone,
        service: svc.name,
        barberId: barber.id,
        date: TARGET_DATE,
        time,
        status: STATUSES[rows.length % STATUSES.length],
        price: svc.price,
      });
      taken.add(time);
      created += 1;
    }

    const finalOccupied = occupied + created;
    const rate = capacity > 0 ? Math.round((finalOccupied / capacity) * 100) : 0;

    summary.push({
      name: barber.name,
      id: barber.id,
      capacity,
      before: occupied,
      created,
      after: finalOccupied,
      rate,
      skipped: capacity === 0,
    });
  }

  if (!rows.length) {
    console.log(`\nNada a criar em ${TARGET_DATE} — agenda já em ou acima de ${Math.round(OCCUPANCY_TARGET * 100)}%.\n`);
    for (const s of summary) {
      if (s.skipped) {
        console.log(`  ${s.name}: sem turno neste dia`);
      } else {
        console.log(`  ${s.name}: ${s.before}/${s.capacity} (${s.rate}%)`);
      }
    }
    return;
  }

  const result = await prisma.appointment.createMany({ data: rows });

  console.log(`\nTenant: ${tenant.name} (${slug})`);
  console.log(`Data: ${TARGET_DATE} · meta ~${Math.round(OCCUPANCY_TARGET * 100)}% de ocupação`);
  console.log(`Criados ${result.count} agendamentos (nomes reais).\n`);

  for (const s of summary) {
    if (s.skipped) {
      console.log(`  ${s.name}: sem expediente / slots neste dia`);
      continue;
    }
    console.log(
      `  ${s.name}: ${s.before} → ${s.after}/${s.capacity} vagas (${s.rate}%)` +
        (s.created ? ` · +${s.created} novos` : ''),
    );
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
