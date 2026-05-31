/**
 * Substitui nomes de clientes de teste por nomes realistas (agendamentos, cadastros e vendas).
 *
 * Uso (pasta server):
 *   node scripts/rename_test_clients.js
 *   node scripts/rename_test_clients.js --slug=two-brothers
 *   node scripts/rename_test_clients.js --dry-run
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { isSyntheticClientName, clientAt } = require('./lib/realClientNames');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const slugFilter = slugArg ? slugArg.split('=')[1].trim().toLowerCase() : null;

async function renameTenant(tenant) {
  let seq = 0;
  const usedNames = new Set();

  const nextProfile = () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const profile = clientAt(seq, '11');
      seq += 1;
      if (!usedNames.has(profile.name)) {
        usedNames.add(profile.name);
        return profile;
      }
    }
    const fallback = clientAt(seq, '11');
    seq += 1;
    return fallback;
  };

  const customers = await prisma.customer.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, phone: true },
  });

  let customersUpdated = 0;
  for (const c of customers) {
    if (!isSyntheticClientName(c.name)) continue;
    const profile = nextProfile();
    if (dryRun) {
      console.log(`  [customer ${c.id}] "${c.name}" → "${profile.name}"`);
    } else {
      await prisma.customer.update({
        where: { id: c.id },
        data: { name: profile.name, phone: profile.phone },
      });
    }
    customersUpdated += 1;
  }

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, customer: true, phone: true, customer_id: true },
  });

  let appointmentsUpdated = 0;
  for (const appt of appointments) {
    if (!isSyntheticClientName(appt.customer)) continue;
    const profile = nextProfile();
    if (dryRun) {
      console.log(`  [appointment ${appt.id}] "${appt.customer}" → "${profile.name}"`);
    } else {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          customer: profile.name,
          phone: appt.phone || profile.phone,
        },
      });
    }
    appointmentsUpdated += 1;
  }

  const sales = await prisma.productSale.findMany({
    where: { tenantId: tenant.id, customerName: { not: null } },
    select: { id: true, customerName: true },
  });

  let salesUpdated = 0;
  for (const sale of sales) {
    if (!isSyntheticClientName(sale.customerName)) continue;
    const profile = nextProfile();
    if (dryRun) {
      console.log(`  [sale ${sale.id}] "${sale.customerName}" → "${profile.name}"`);
    } else {
      await prisma.productSale.update({
        where: { id: sale.id },
        data: { customerName: profile.name },
      });
    }
    salesUpdated += 1;
  }

  return { customersUpdated, appointmentsUpdated, salesUpdated };
}

async function main() {
  const tenants = slugFilter
    ? await prisma.tenant.findMany({ where: { slug: slugFilter } })
    : await prisma.tenant.findMany({ orderBy: { id: 'asc' } });

  if (!tenants.length) {
    console.error(slugFilter ? `Tenant "${slugFilter}" não encontrado.` : 'Nenhum tenant no banco.');
    process.exit(1);
  }

  console.log(dryRun ? '\n[DRY RUN] Nenhuma alteração será gravada.\n' : '\nRenomeando clientes de teste…\n');

  let total = { customersUpdated: 0, appointmentsUpdated: 0, salesUpdated: 0 };

  for (const tenant of tenants) {
    console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
    const stats = await renameTenant(tenant);
    total.customersUpdated += stats.customersUpdated;
    total.appointmentsUpdated += stats.appointmentsUpdated;
    total.salesUpdated += stats.salesUpdated;
    console.log(
      `  → ${stats.customersUpdated} cadastro(s), ${stats.appointmentsUpdated} agendamento(s), ${stats.salesUpdated} venda(s)\n`,
    );
  }

  console.log(
    `Total: ${total.customersUpdated} cadastros, ${total.appointmentsUpdated} agendamentos, ${total.salesUpdated} vendas.`,
  );
  if (dryRun) console.log('\nExecute sem --dry-run para aplicar.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
