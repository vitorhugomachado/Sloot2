// Entry point — load env before any module that touches Prisma
const path = require('path');
const { execSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const required = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Variáveis obrigatórias em falta: ${missing.join(', ')}`);
  if (missing.includes('DIRECT_URL')) {
    console.error('Railway: DIRECT_URL = mesmo valor que DATABASE_URL (${{Postgres.DATABASE_URL}}).');
  }
  process.exit(1);
}

function logDbTarget() {
  try {
    const raw = process.env.DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'http://');
    const u = new URL(raw);
    const railway = /\.railway\.(app|internal)/i.test(u.hostname);
    console.log(`[db] migrate deploy → host=${u.hostname}${railway ? ' (Railway)' : ''}`);
  } catch {
    console.log('[db] migrate deploy → DATABASE_URL definida');
  }
}

function runMigrations() {
  logDbTarget();
  console.log('Aplicando migrations Prisma (migrate deploy)...');
  try {
    execSync('npx prisma migrate deploy', {
      cwd: __dirname,
      stdio: 'inherit',
      env: process.env,
    });
    console.log('Migrations aplicadas com sucesso.');
  } catch (err) {
    console.error('Falha em prisma migrate deploy.');
    console.error(
      'Railway Postgres: DATABASE_URL e DIRECT_URL = ${{Postgres.DATABASE_URL}} (mesmo valor).',
    );
    process.exit(1);
  }
}

runMigrations();
require('./scripts/verify_deploy_source');
require('./src/server');
