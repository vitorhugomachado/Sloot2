require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log('SELECT 1 OK:', rows);
    const barbers = await prisma.barber.count().catch((e) => {
      console.error('Barber.count failed:', e.code, e.message);
      throw e;
    });
    console.log('Barber count:', barbers);
    const mc = await prisma.monthClosing.count();
    console.log('MonthClosing count:', mc);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
