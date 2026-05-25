// Entry point — load env before any module that touches Prisma
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '.env');
// Produção (Railway): variáveis vêm do dashboard — não depender de server/.env no Docker
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: envPath, quiet: true });
} else if (!process.env.DATABASE_URL?.trim() && fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, quiet: true });
}

const required = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Variáveis obrigatórias em falta: ${missing.join(', ')}`);
  console.error(
    '[debug] presentes no container:',
    required.map((k) => `${k}=${process.env[k]?.trim() ? 'sim' : 'NAO'}`).join(', '),
  );
  console.error(
    'Railway → serviço APP (Sloot) → Variables: olho em DATABASE_URL — se vazio, ${{Postgres.DATABASE_URL}} tem nome de serviço errado.',
  );
  console.error(
    'Correção: cola URL completa em DATABASE_URL e DIRECT_URL (mesmo valor, ex. postgres.railway.internal:5432/railway).',
  );
  console.error('Depois de guardar, Redeploy.');
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.error(`[debug] RAILWAY_ENVIRONMENT=${process.env.RAILWAY_ENVIRONMENT}`);
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
