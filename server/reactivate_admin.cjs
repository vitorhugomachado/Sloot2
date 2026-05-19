const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@admin.com';
  const barber = await prisma.barber.update({
    where: { email },
    data: { status: 'Ativo' },
    select: { id: true, email: true, name: true, status: true, role: true },
  });
  console.log('Conta reativada:', barber);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
