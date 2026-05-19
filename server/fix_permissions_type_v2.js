const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Corrigindo tipo da coluna permissions (Versão 2) ---');
  try {
    // Truque para converter JSON array string para PG Array string e então para text[]
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."Barber" 
      ALTER COLUMN permissions TYPE text[] 
      USING translate(permissions::text, '[]', '{}')::text[];
    `);
    console.log('✅ Coluna permissions convertida para text[].');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
