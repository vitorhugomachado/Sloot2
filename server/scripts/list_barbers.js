/**
 * Lista profissionais (staff) com e-mail de login — sem expor senhas.
 * Uso (na pasta server): npm run list:barbers
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const HIGHLIGHT_NEEDLES = ['paulo', 'romario', 'junior'];

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isHighlighted(name) {
  const n = norm(name);
  return HIGHLIGHT_NEEDLES.some((needle) => n.includes(needle));
}

function pad(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

async function main() {
  const barbers = await prisma.barber.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!barbers.length) {
    console.log('Nenhum profissional encontrado (deletedAt = null).');
    return;
  }

  console.log('\nUtilizadores staff (login em /barbeiros/login)\n');
  console.log(
    `${pad('ID', 4)}  ${pad('Nome', 22)}  ${pad('E-mail', 32)}  ${pad('Papel', 10)}  Status`,
  );
  console.log('-'.repeat(88));

  for (const b of barbers) {
    const mark = isHighlighted(b.name) ? ' *' : '  ';
    console.log(
      `${mark}${pad(b.id, 4)}  ${pad(b.name, 22)}  ${pad(b.email, 32)}  ${pad(b.role, 10)}  ${b.status}`,
    );
  }

  const highlighted = barbers.filter((b) => isHighlighted(b.name));
  if (highlighted.length) {
    console.log('\n* = nome contém paulo, romario ou junior');
  }

  console.log('\nSenha: a definida no cadastro (padrão da app ao criar: 123).\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
