const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

if (!globalForPrisma.__slootPrisma) {
  globalForPrisma.__slootPrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

module.exports = globalForPrisma.__slootPrisma;
