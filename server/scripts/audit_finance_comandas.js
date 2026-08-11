/**
 * Audita inconsistências em comandas/caixa (dados legados pós-bug de pagamento parcial).
 * Uso: node scripts/audit_finance_comandas.js [--tenant-id=1] [--fix-hint]
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const tenantArg = process.argv.find((a) => a.startsWith('--tenant-id='));
const tenantFilter = tenantArg ? Number(tenantArg.split('=')[1]) : null;

function paidFromJson(payments) {
  if (!payments || typeof payments !== 'object') return 0;
  const splits = Array.isArray(payments.splits) ? payments.splits : [];
  return Math.round(splits.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100;
}

async function main() {
  const where = tenantFilter ? { tenantId: tenantFilter } : {};
  const comandas = await prisma.comanda.findMany({
    where: {
      ...where,
      status: { in: ['PARTIAL', 'QUITADA'] },
    },
    select: {
      id: true,
      tenantId: true,
      number: true,
      status: true,
      total: true,
      payments: true,
    },
    orderBy: { id: 'asc' },
  });

  const issues = [];

  for (const c of comandas) {
    const payments = await prisma.comandaPayment.aggregate({
      where: { comandaId: c.id, tenantId: c.tenantId },
      _sum: { amount: true },
    });
    const paidTable = Math.round(Number(payments._sum.amount || 0) * 100) / 100;
    const paidJson = paidFromJson(c.payments);
    const total = Number(c.total || 0);

    if (Math.abs(paidTable - paidJson) > 0.02) {
      issues.push({
        type: 'PAYMENT_SUM_MISMATCH',
        comandaId: c.id,
        tenantId: c.tenantId,
        number: c.number,
        status: c.status,
        paidTable,
        paidJson,
      });
    }

    if (paidTable > total + 0.02) {
      issues.push({
        type: 'OVERPAID',
        comandaId: c.id,
        tenantId: c.tenantId,
        number: c.number,
        status: c.status,
        total,
        paidTable,
      });
    }

    const movements = await prisma.cashMovement.findMany({
      where: {
        tenantId: c.tenantId,
        referenceType: 'Comanda',
        referenceId: c.id,
        source: 'COMANDA',
        type: 'IN',
      },
      select: { id: true, amount: true, cashSessionId: true, createdAt: true, method: true },
    });

    const payCount = await prisma.comandaPayment.count({ where: { comandaId: c.id } });
    if (movements.length !== payCount) {
      issues.push({
        type: 'MOVEMENT_PAYMENT_COUNT_MISMATCH',
        comandaId: c.id,
        tenantId: c.tenantId,
        number: c.number,
        movements: movements.length,
        payments: payCount,
      });
    }

    const dupKeys = new Map();
    for (const m of movements) {
      const key = `${m.cashSessionId}|${m.amount}|${m.method}|${m.createdAt?.toISOString?.() || ''}`;
      dupKeys.set(key, (dupKeys.get(key) || 0) + 1);
    }
    for (const [key, count] of dupKeys) {
      if (count > 1) {
        issues.push({
          type: 'DUPLICATE_MOVEMENT',
          comandaId: c.id,
          tenantId: c.tenantId,
          number: c.number,
          key,
          count,
        });
      }
    }
  }

  const summary = {
    scanned: comandas.length,
    issueCount: issues.length,
    tenantFilter,
    issues,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (issues.length) process.exit(2);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
