/**
 * Cria 10 agendamentos por dia em 2026-05-12, 2026-05-13 e 2026-05-14,
 * repartidos em rodízio entre os barbeiros cujo nome contém (case insensitive):
 * "paulo", "romario" (ou "romário") e "junior" (ou "júnior").
 *
 * Uso (na pasta server): node scripts/seed_paulo_romario_junior_may.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DATES = ['2026-05-12', '2026-05-13', '2026-05-14'];
const TIME_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30'];

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findBarber(barbers, ...needles) {
  for (const b of barbers) {
    const n = norm(b.name);
    for (const needle of needles) {
      if (n.includes(norm(needle))) return b;
    }
  }
  return null;
}

async function main() {
  const services = await prisma.service.findMany({ orderBy: { id: 'asc' } });
  if (!services.length) {
    console.error('Nenhum serviço no banco. Cadastre serviços ou rode prisma seed.');
    process.exit(1);
  }

  const barbers = await prisma.barber.findMany({
    where: { deletedAt: null, status: 'Ativo' },
    orderBy: { id: 'asc' },
  });

  const paulo = findBarber(barbers, 'paulo');
  const romario = findBarber(barbers, 'romario', 'romário');
  const junior = findBarber(barbers, 'junior', 'júnior');

  const missing = [];
  if (!paulo) missing.push('Paulo');
  if (!romario) missing.push('Romário/Romario');
  if (!junior) missing.push('Junior/Júnior');
  if (missing.length) {
    console.error('Não encontrei barbeiro(es):', missing.join(', '));
    console.error('Barbeiros ativos no banco:', barbers.map((b) => `${b.id}: ${b.name}`).join(' | ') || '(nenhum)');
    process.exit(1);
  }

  const trio = [paulo, romario, junior];
  const rows = [];
  let phoneSeq = 10000100;

  for (const date of DATES) {
    for (let i = 0; i < 10; i++) {
      const barber = trio[i % 3];
      const svc = services[i % services.length];
      rows.push({
        customer: `Cliente ${date.slice(8, 10)}/${date.slice(5, 7)} #${i + 1}`,
        phone: `119${String(phoneSeq++).padStart(8, '0')}`,
        service: svc.name,
        barberId: barber.id,
        date,
        time: TIME_SLOTS[i],
        status: 'Agendado',
        price: svc.price,
      });
    }
  }

  const result = await prisma.appointment.createMany({ data: rows });
  const perDay = 10;
  const pauloCount = DATES.length * [0, 3, 6, 9].length; // slots i%3===0
  const romarioCount = DATES.length * [1, 4, 7].length;
  const juniorCount = DATES.length * [2, 5, 8].length;
  console.log(`Criados ${result.count} agendamentos (${perDay} por dia × ${DATES.length} dias).`);
  console.log(`  ${paulo.name} (id ${paulo.id}): ${pauloCount}`);
  console.log(`  ${romario.name} (id ${romario.id}): ${romarioCount}`);
  console.log(`  ${junior.name} (id ${junior.id}): ${juniorCount}`);
  console.log('Datas:', DATES.join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
