/**
 * Valida schema financeiro (caixa/comandas) no Postgres conectado via DATABASE_URL.
 * Uso: node scripts/verify_finance_migrations.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const REQUIRED_MIGRATIONS = [
  '20260810190000_cash_session_one_open_per_tenant',
  '20260810190100_comanda_payment_status_enums',
];

async function main() {
  const checks = [];
  let ok = true;

  const applied = await prisma.$queryRaw`
    SELECT migration_name, finished_at
    FROM "_prisma_migrations"
    WHERE migration_name = ANY(${REQUIRED_MIGRATIONS})
    ORDER BY migration_name
  `;

  for (const name of REQUIRED_MIGRATIONS) {
    const row = applied.find((r) => r.migration_name === name);
    const pass = Boolean(row?.finished_at);
    checks.push({
      check: `migration:${name}`,
      pass,
      warn: !pass,
      detail: row?.finished_at || 'missing (schema may have been applied manually)',
    });
  }

  const [cashStatusCol] = await prisma.$queryRaw`
    SELECT udt_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'CashSession' AND column_name = 'status'
  `;
  const cashEnum = cashStatusCol?.udt_name === 'CashSessionStatus';
  if (!cashEnum) ok = false;
  checks.push({
    check: 'CashSession.status enum',
    pass: cashEnum,
    detail: cashStatusCol?.udt_name || 'unknown',
  });

  const [comandaStatusCol] = await prisma.$queryRaw`
    SELECT udt_name
    FROM information_schema.columns
    WHERE table_name = 'Comanda' AND column_name = 'status'
  `;
  const comandaEnum = comandaStatusCol?.udt_name === 'ComandaStatus';
  if (!comandaEnum) ok = false;
  checks.push({
    check: 'Comanda.status enum',
    pass: comandaEnum,
    detail: comandaStatusCol?.udt_name || 'unknown',
  });

  const [indexRow] = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'CashSession' AND indexname = 'CashSession_tenantId_open_unique'
  `;
  const hasIndex = Boolean(indexRow?.indexname);
  if (!hasIndex) ok = false;
  checks.push({ check: 'partial unique index', pass: hasIndex, detail: indexRow?.indexname || 'missing' });

  const [tableRow] = await prisma.$queryRaw`
    SELECT to_regclass('"ComandaPayment"')::text AS reg
  `;
  const hasTable = Boolean(tableRow?.reg);
  if (!hasTable) ok = false;
  checks.push({ check: 'ComandaPayment table', pass: hasTable, detail: String(tableRow?.reg || 'missing') });

  const [{ count: paymentCount }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count FROM "ComandaPayment"
  `;
  checks.push({ check: 'ComandaPayment rows', pass: true, detail: String(paymentCount) });

  console.log(JSON.stringify({ ok, checks }, null, 2));
  if (!ok) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
