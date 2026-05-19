const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Barber'
  `);
  console.log(JSON.stringify(columns, null, 2));
}

main().finally(() => prisma.$disconnect());
