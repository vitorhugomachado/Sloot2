/**
 * Preenche payments.paidAt em agendamentos Finalizado que ainda não têm (usa a data do agendamento).
 * Para refletir a data real do pagamento, marque novamente como pago após o deploy.
 *
 * Uso: node scripts/backfill_paid_at.js [--slug=two-brothers]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { getLocalDateIso } = require('../src/utils/appointmentTime');

const prisma = new PrismaClient();
const today = getLocalDateIso();
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const slug = (slugArg ? slugArg.split('=')[1] : process.env.DEFAULT_TENANT_SLUG || 'two-brothers')
  .trim()
  .toLowerCase();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant "${slug}" não encontrado.`);
    process.exit(1);
  }

  const rows = await prisma.appointment.findMany({
    where: { tenantId: tenant.id, status: 'Finalizado' },
    select: { id: true, date: true, payments: true },
  });

  let updated = 0;
  for (const row of rows) {
    let payments = row.payments;
    if (payments && typeof payments === 'object' && !Array.isArray(payments)) {
      if (payments.paidAt) continue;
      const paidAt = row.date > today ? today : row.date;
      payments = { ...payments, paidAt };
    } else {
      const paidAt = row.date > today ? today : row.date;
      payments = { paidAt };
    }
    await prisma.appointment.update({
      where: { id: row.id },
      data: { payments },
    });
    updated += 1;
  }

  console.log(`Atualizados ${updated} agendamentos (paidAt = data do agendamento onde faltava).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
