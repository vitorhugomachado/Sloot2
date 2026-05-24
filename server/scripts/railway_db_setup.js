/**
 * Aplica migrations + seed no Postgres (ex.: Railway).
 * Uso (PowerShell):
 *   $env:DATABASE_URL="postgresql://..."
 *   $env:DIRECT_URL=$env:DATABASE_URL
 *   $env:DEFAULT_TENANT_SLUG="two-brothers"
 *   node server/scripts/railway_db_setup.js
 */
const { execSync } = require('child_process');
const path = require('path');

const serverRoot = path.join(__dirname, '..');

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Defina ${name} (connection string do Postgres Railway).`);
    process.exit(1);
  }
  return v;
}

function logDbHost() {
  try {
    const raw = process.env.DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'http://');
    const u = new URL(raw);
    console.log(`[db] host=${u.hostname} db=${u.pathname.replace(/^\//, '') || 'postgres'}`);
  } catch {
    console.log('[db] DATABASE_URL definida');
  }
}

requireEnv('DATABASE_URL');
if (!process.env.DIRECT_URL?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  console.log('[db] DIRECT_URL não definida — a usar DATABASE_URL');
}
requireEnv('DIRECT_URL');

logDbHost();

const env = { ...process.env };

console.log('\n1/2 prisma migrate deploy...');
execSync('npx prisma migrate deploy', { cwd: serverRoot, stdio: 'inherit', env });

console.log('\n2/2 prisma db seed...');
execSync('npx prisma db seed', { cwd: serverRoot, stdio: 'inherit', env });

console.log('\nConcluído. Tenant:', process.env.DEFAULT_TENANT_SLUG || 'two-brothers');
console.log('Opcional — admin plataforma: cd server && npm run create:platform-admin -- email senha');
