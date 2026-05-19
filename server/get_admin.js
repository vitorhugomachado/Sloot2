const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.barber.findFirst({ where: { role: 'Gerente' }});
  console.log("Admin email:", admin.email);
}
main().finally(() => prisma.$disconnect());
