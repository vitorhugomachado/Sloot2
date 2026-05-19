const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addIndexes() {
  console.log('Criando índices de performance...');
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_appointment_date" ON "Appointment"("date");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_appointment_status" ON "Appointment"("status");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_appointment_barber" ON "Appointment"("barberId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_productsale_date" ON "ProductSale"("date");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_barber_deleted" ON "Barber"("deletedAt");`);
    console.log('✅ Índices criados com sucesso no banco de dados!');
  } catch (error) {
    console.error('❌ Erro ao criar índices (talvez já existam):', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addIndexes();
