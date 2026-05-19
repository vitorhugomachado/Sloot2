const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const barbers = await prisma.barber.findMany({
    select: {
      email: true,
      password: true
    }
  });
  console.log(JSON.stringify(barbers, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
