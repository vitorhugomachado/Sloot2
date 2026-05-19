const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Liberando E-mails de Usuários Excluídos ---');
  try {
    const deletedBarbers = await prisma.barber.findMany({
      where: {
        deletedAt: { not: null }
      }
    });

    for (const barber of deletedBarbers) {
      if (!barber.email.includes('_deleted_')) {
        const fakeEmail = `${barber.email}_deleted_${Date.now()}`;
        await prisma.barber.update({
          where: { id: barber.id },
          data: { email: fakeEmail }
        });
        console.log(`✅ E-mail liberado: ${barber.email}`);
      }
    }
    console.log('Processo finalizado.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
