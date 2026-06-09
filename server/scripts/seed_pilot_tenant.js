/**
 * Provisiona tenant piloto completo para validação MVP (serviços, equipe, turnos, branding).
 * Idempotente: atualiza dados existentes; use --recreate para apagar e recriar.
 *
 * Uso:
 *   node scripts/seed_pilot_tenant.js
 *   node scripts/seed_pilot_tenant.js --slug=slooti-piloto
 *   node scripts/seed_pilot_tenant.js --recreate
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/auth');
const { invalidatePublicCache } = require('../src/middlewares/publicCache');
const { DEFAULT_ENABLED_MODULES } = require('../src/lib/tenantModules');

const args = process.argv.slice(2);
const slug = (args.find((a) => a.startsWith('--slug=')) || '--slug=slooti-piloto')
  .split('=')[1]
  .trim()
  .toLowerCase();
const recreate = args.includes('--recreate');

const MANAGER_EMAIL = process.env.PILOT_MANAGER_EMAIL || 'gerente@slooti-piloto.test';
const MANAGER_PASSWORD = process.env.PILOT_MANAGER_PASSWORD || 'SlootiPiloto123';
const BARBER_EMAIL = process.env.PILOT_BARBER_EMAIL || 'barbeiro@slooti-piloto.test';
const BARBER_PASSWORD = process.env.PILOT_BARBER_PASSWORD || 'SlootiPiloto123';

const PILOT_SERVICES = [
  { name: 'Corte masculino', price: 45, duration: '45 min' },
  { name: 'Barba completa', price: 35, duration: '30 min' },
  { name: 'Corte + barba', price: 70, duration: '1h' },
  { name: 'Sobrancelha', price: 20, duration: '15 min' },
];

const WEEKDAYS = [1, 2, 3, 4, 5, 6];

function shiftRowsForBarber(barberId) {
  const rows = [];
  for (const dia of WEEKDAYS) {
    rows.push({
      id_barbeiro: barberId,
      dia_semana: dia,
      hora_inicio: '09:00',
      hora_fim: '12:00',
      ativo: true,
    });
    rows.push({
      id_barbeiro: barberId,
      dia_semana: dia,
      hora_inicio: '13:00',
      hora_fim: '19:00',
      ativo: true,
    });
  }
  return rows;
}

const prisma = new PrismaClient();

async function ensureShifts(barberId) {
  const existing = await prisma.workingShifts.count({ where: { id_barbeiro: barberId } });
  if (existing > 0) return;
  await prisma.workingShifts.createMany({ data: shiftRowsForBarber(barberId) });
}

async function ensureServices(tenantId) {
  const count = await prisma.service.count({ where: { tenantId } });
  if (count >= PILOT_SERVICES.length) return;
  for (const service of PILOT_SERVICES) {
    const found = await prisma.service.findFirst({
      where: { tenantId, name: service.name },
    });
    if (!found) {
      await prisma.service.create({ data: { ...service, tenantId } });
    }
  }
}

async function main() {
  if (recreate) {
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      await prisma.tenant.delete({ where: { id: existing.id } });
      console.log(`Tenant "${slug}" removido (--recreate).`);
    }
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug } });

  const branding = {
    name: 'Slooti Barbearia Piloto',
    phone: '(11) 98765-4321',
    email: 'contato@slooti-piloto.test',
    address: 'Rua das Flores, 100 — São Paulo, SP',
    tagline: 'Seu estilo, nosso cuidado',
    slogan: 'Agende online em segundos',
    whatsapp_url: 'https://wa.me/5511987654321',
    instagram_url: 'https://instagram.com/slooti',
    show_whatsapp: true,
    show_instagram: true,
    enabledModules: DEFAULT_ENABLED_MODULES,
    status: 'active',
  };

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { slug, ...branding },
    });
    console.log(`Tenant criado: ${tenant.name} (/${slug})`);
  } else {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: branding,
    });
    console.log(`Tenant atualizado: ${tenant.name} (/${slug})`);
  }

  const managerHash = await hashPassword(MANAGER_PASSWORD);
  let manager = await prisma.barber.findFirst({
    where: { tenantId: tenant.id, email: MANAGER_EMAIL },
  });

  if (!manager) {
    manager = await prisma.barber.create({
      data: {
        tenantId: tenant.id,
        name: 'Gerente Piloto',
        email: MANAGER_EMAIL,
        password: managerHash,
        role: 'Gerente',
        status: 'Ativo',
        permissions: [
          'dashboard',
          'scheduler',
          'clients',
          'finance',
          'users',
          'settings',
          'inventory',
        ],
      },
    });
    console.log(`  + Gerente: ${MANAGER_EMAIL}`);
  } else {
    await prisma.barber.update({
      where: { id: manager.id },
      data: { password: managerHash, status: 'Ativo' },
    });
    console.log(`  = Gerente existente: ${MANAGER_EMAIL}`);
  }

  await ensureShifts(manager.id);

  const barberHash = await hashPassword(BARBER_PASSWORD);
  let barber = await prisma.barber.findFirst({
    where: { tenantId: tenant.id, email: BARBER_EMAIL },
  });

  if (!barber) {
    barber = await prisma.barber.create({
      data: {
        tenantId: tenant.id,
        name: 'João Barbeiro',
        email: BARBER_EMAIL,
        password: barberHash,
        role: 'Barbeiro',
        status: 'Ativo',
        permissions: ['scheduler', 'clients'],
      },
    });
    console.log(`  + Barbeiro: ${BARBER_EMAIL}`);
  } else {
    await prisma.barber.update({
      where: { id: barber.id },
      data: { password: barberHash, status: 'Ativo' },
    });
    console.log(`  = Barbeiro existente: ${BARBER_EMAIL}`);
  }

  await ensureShifts(barber.id);
  await ensureServices(tenant.id);

  invalidatePublicCache(slug);

  const serviceCount = await prisma.service.count({ where: { tenantId: tenant.id } });
  const barberCount = await prisma.barber.count({
    where: { tenantId: tenant.id, deletedAt: null, status: 'Ativo' },
  });
  const shiftCount = await prisma.workingShifts.count({
    where: { id_barbeiro: { in: [manager.id, barber.id] }, ativo: true },
  });

  console.log('\n--- Resumo piloto ---');
  console.log(`  Slug: ${slug}`);
  console.log(`  Serviços: ${serviceCount}`);
  console.log(`  Profissionais ativos: ${barberCount}`);
  console.log(`  Turnos ativos: ${shiftCount}`);
  console.log(`  Gerente: ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
  console.log(`  Barbeiro: ${BARBER_EMAIL} / ${BARBER_PASSWORD}`);
  console.log(`  Público: /${slug}`);
  console.log(`  Staff: /${slug}/login`);
  console.log(`  Painel: /${slug}/dashboard`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
