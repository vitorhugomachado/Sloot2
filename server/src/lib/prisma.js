const { PrismaClient } = require('@prisma/client');

/** Interactive transactions that hit remote Postgres (Railway) need more than the 5s default. */
const HEAVY_TX = { maxWait: 10_000, timeout: 20_000 };

const globalForPrisma = globalThis;

if (!globalForPrisma.__slootPrisma) {
  globalForPrisma.__slootPrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const prisma = globalForPrisma.__slootPrisma;

module.exports = prisma;
module.exports.HEAVY_TX = HEAVY_TX;
