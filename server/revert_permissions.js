const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Restaurando Jsonb ---');
  try {
    // Reverter de volta para JSONB
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."Barber" 
      ALTER COLUMN permissions TYPE jsonb 
      USING array_to_json(permissions)::jsonb;
    `);
    console.log('✅ Coluna permissions revertida para jsonb.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
