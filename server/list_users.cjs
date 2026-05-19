const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUsers() {
  try {
    console.log('--- BARBEIROS / ADMINS ---');
    const barbers = await prisma.barber.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true
      }
    });
    console.table(barbers);

    console.log('\n--- CLIENTES ---');
    const customers = await prisma.customer.findMany({
      select: {
        name: true,
        email: true,
        phone: true
      }
    });
    console.table(customers);

  } catch (error) {
    console.error('Erro ao listar usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
