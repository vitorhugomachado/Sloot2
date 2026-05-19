const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Hard Reset da Coluna Permissions ---');
  try {
    // 1. Extrair os valores existentes (para backup se necessário)
    // 2. Apagar a coluna e recriar como JSONB puro
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."Barber" DROP COLUMN IF EXISTS permissions;
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public."Barber" ADD COLUMN permissions jsonb DEFAULT '["dashboard", "scheduler", "clients"]'::jsonb;
    `);
    
    // Conceder algumas permissoes extras pro admin 
    await prisma.$executeRawUnsafe(`
      UPDATE public."Barber" SET permissions = '["dashboard", "scheduler", "clients", "finance", "users", "settings"]'::jsonb WHERE role = 'Gerente' OR email = 'admin@admin.com';
    `);

    console.log('✅ Hard reset concluído. Coluna permissions 100% limpa e compativel com prisma Json.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
