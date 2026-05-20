/**
 * Diagnóstico: serviços de um tenant (slug).
 * Uso: node scripts/check_tenant_services.js lanotic
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const slug = (process.argv[2] || 'lanotic').trim().toLowerCase();
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.log(`Tenant "${slug}" não encontrado.`);
    return;
  }
  console.log(`\nTenant: ${tenant.name} (${tenant.slug}) id=${tenant.id}\n`);

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id },
    orderBy: { id: 'asc' },
  });

  if (services.length === 0) {
    console.log('Nenhum serviço cadastrado — a página do cliente mostra "Nenhum serviço disponível".');
    console.log('Cadastre serviços em Configurações (painel do gestor em /lanotic/barbeiros).');
  } else {
    console.log(`Serviços (${services.length}):`);
    for (const s of services) {
      console.log(`  [${s.id}] ${s.name} — R$ ${s.price} — ${s.duration || s.duracao || '?'}`);
    }
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
