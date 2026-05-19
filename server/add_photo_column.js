const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Adicionando coluna foto_perfil ---');
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE public."Barber" ADD COLUMN IF NOT EXISTS foto_perfil TEXT;');
    console.log('✅ Coluna foto_perfil garantida.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
