const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Corrigindo tipos das colunas em horarios_trabalho ---');
  try {
    // 1. Alterar id_barbeiro para Integer
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."horarios_trabalho" ALTER COLUMN id_barbeiro TYPE integer USING id_barbeiro::integer;
    `);
    
    // 2. Alterar hora_inicio e hora_fim para TEXT
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."horarios_trabalho" ALTER COLUMN hora_inicio TYPE text USING hora_inicio::text;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."horarios_trabalho" ALTER COLUMN hora_fim TYPE text USING hora_fim::text;
    `);

    console.log('✅ Hard reset concluído. Colunas 100% compativeis com prisma.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
