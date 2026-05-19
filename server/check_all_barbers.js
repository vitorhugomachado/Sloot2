const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const barbers = await prisma.barber.findMany({
    select: { id: true, name: true, email: true, deletedAt: true }
  });
  console.log(JSON.stringify(barbers, null, 2));
}

main().finally(() => prisma.$disconnect());
