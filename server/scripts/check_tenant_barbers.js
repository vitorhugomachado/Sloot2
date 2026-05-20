/**
 * Diagnóstico: barbeiros públicos de um tenant (slug).
 * Uso: node scripts/check_tenant_barbers.js lanotic
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
  console.log(`\nTenant: ${tenant.name} (${tenant.slug}) id=${tenant.id} status=${tenant.status}\n`);

  const barbers = await prisma.barber.findMany({
    where: { tenantId: tenant.id },
    include: { shifts: { orderBy: { dia_semana: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  const publicEligible = barbers.filter(
    (b) => !b.deletedAt && b.status === 'Ativo' && b.role === 'Barbeiro',
  );

  console.log('--- Todos os profissionais ---');
  for (const b of barbers) {
    const okPublic = !b.deletedAt && b.status === 'Ativo' && b.role === 'Barbeiro';
    const activeShifts = (b.shifts || []).filter((s) => s.ativo !== false);
    console.log(
      `  [${b.id}] ${b.name} | role=${b.role} | status=${b.status} | deleted=${!!b.deletedAt} | shifts=${activeShifts.length} ativos | aparece no cliente=${okPublic ? 'SIM' : 'NÃO'}`,
    );
    if (!okPublic && b.role === 'Gerente') {
      console.log('      → Gestores não aparecem na página de agendamento (só role "Barbeiro").');
    }
    if (okPublic && activeShifts.length === 0) {
      console.log('      → Aparece na lista, mas sem horários até configurar expediente (turnos).');
    }
  }

  console.log('\n--- Apareceriam em /public/bootstrap (API) ---');
  if (publicEligible.length === 0) {
    console.log('  (nenhum)');
  } else {
    publicEligible.forEach((b) => {
      const activeShifts = (b.shifts || []).filter((s) => s.ativo !== false);
      console.log(`  [${b.id}] ${b.name} — ${activeShifts.length} turno(s) ativo(s)`);
    });
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
