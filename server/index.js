// Entry point — load env before any module that touches Prisma
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Variáveis obrigatórias em falta: ${missing.join(', ')}`);
  process.exit(1);
}

require('./src/server');
