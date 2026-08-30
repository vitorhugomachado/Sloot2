/**
 * Cria 10 barbeiros + 10 serviços de teste no tenant lanotic (barbearia do tic).
 * Uso: node scripts/seed_lanotic_test_data.js
 *      node scripts/seed_lanotic_test_data.js --slug=lanotic
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/auth');
const { invalidatePublicCache } = require('../src/middlewares/publicCache');

const slug = (process.argv.find((a) => a.startsWith('--slug=')) || '--slug=lanotic')
  .split('=')[1]
  .trim()
  .toLowerCase();

const prisma = new PrismaClient();

const SERVICE_TEMPLATES = [
  { name: 'Corte masculino', price: 45, duration: '45 min', bookingIcon: 'cut' },
  { name: 'Barba completa', price: 35, duration: '30 min', bookingIcon: 'beard' },
  { name: 'Corte + barba', price: 70, duration: '1h', bookingIcon: 'combo' },
  { name: 'Sobrancelha', price: 20, duration: '15 min' },
  { name: 'Pezinho e nuca', price: 25, duration: '20 min' },
  { name: 'Hidratação capilar', price: 55, duration: '45 min' },
  { name: 'Pigmentação barba', price: 40, duration: '30 min' },
  { name: 'Corte infantil', price: 40, duration: '40 min', bookingIcon: 'cut' },
  { name: 'Relaxamento', price: 60, duration: '50 min' },
  { name: 'Pacote vip', price: 120, duration: '1h 30 min' },
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

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant "${slug}" não encontrado.`);
    process.exit(1);
  }

  const pwd = await hashPassword('123');
  const stamp = Date.now();
  const createdBarbers = [];

  console.log(`\nTenant: ${tenant.name} (${slug}) id=${tenant.id}\n`);

  for (let i = 1; i <= 10; i += 1) {
    const email = `barbeiro-teste-${stamp}-${i}@lanotic.test`;
    const barber = await prisma.barber.create({
      data: {
        tenantId: tenant.id,
        name: `Barbeiro Teste ${i}`,
        email,
        password: pwd,
        role: 'Barbeiro',
        status: 'Ativo',
        permissions: ['scheduler', 'clients'],
      },
    });
    await prisma.workingShifts.createMany({ data: shiftRowsForBarber(barber.id) });
    createdBarbers.push(barber);
    console.log(`  + Barbeiro [${barber.id}] ${barber.name} (${email})`);
  }

  const serviceData = SERVICE_TEMPLATES.map((s, idx) => ({
    tenantId: tenant.id,
    name: `${s.name} (teste ${stamp % 10000}-${idx + 1})`,
    price: s.price,
    duration: s.duration,
    bookingIcon: s.bookingIcon || 'generic',
  }));

  const { count: serviceCount } = await prisma.service.createMany({ data: serviceData });
  console.log(`\n  + ${serviceCount} serviços criados\n`);

  invalidatePublicCache(slug);

  const allServices = await prisma.service.count({ where: { tenantId: tenant.id } });
  const publicBarbers = await prisma.barber.findMany({
    where: { tenantId: tenant.id, deletedAt: null, status: 'Ativo', role: 'Barbeiro' },
    include: { shifts: true },
  });

  console.log('--- Validação (critérios da página do cliente) ---');
  console.log(`  Serviços no tenant (total): ${allServices}`);
  console.log(`  Barbeiros elegíveis (role=Barbeiro, Ativo): ${publicBarbers.length}`);
  publicBarbers.slice(-10).forEach((b) => {
    const activeShifts = (b.shifts || []).filter((s) => s.ativo !== false);
    console.log(`    [${b.id}] ${b.name} — ${activeShifts.length} turno(s)`);
  });

  console.log('\nLogin de teste (qualquer barbeiro novo): senha 123');
  console.log(`Cliente: /${slug}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
