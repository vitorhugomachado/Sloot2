const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Corrigindo tipo da coluna permissions ---');
  try {
    // Converter jsonb para text[]
    await prisma.$executeRawUnsafe('ALTER TABLE public."Barber" ALTER COLUMN permissions TYPE text[] USING permissions::text::text[];');
    console.log('✅ Coluna permissions convertida para text[].');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
