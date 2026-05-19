const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Configurando Soft Delete ---');
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE public."Barber" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE;');
    console.log('✅ Coluna deletedAt garantida.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
