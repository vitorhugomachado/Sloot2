const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const barberDupes = await prisma.$queryRaw`
    SELECT email, COUNT(*)::int as cnt FROM "Barber" GROUP BY email HAVING COUNT(*) > 1
  `;
  const customerDupes = await prisma.$queryRaw`
    SELECT email, COUNT(*)::int as cnt FROM "Customer" WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1
  `;
  const monthDupes = await prisma.$queryRaw`
    SELECT "yearMonth", COUNT(*)::int as cnt FROM "MonthClosing" GROUP BY "yearMonth" HAVING COUNT(*) > 1
  `;

  console.log('Barber email duplicates:', barberDupes.length, JSON.stringify(barberDupes));
  console.log('Customer email duplicates:', customerDupes.length, JSON.stringify(customerDupes));
  console.log('MonthClosing yearMonth duplicates:', monthDupes.length, JSON.stringify(monthDupes));

  const hasDupes = barberDupes.length + customerDupes.length + monthDupes.length > 0;
  process.exit(hasDupes ? 2 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
