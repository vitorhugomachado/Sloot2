// Entry point — load env before any module that touches Prisma
const path = require('path');
const { execSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Variáveis obrigatórias em falta: ${missing.join(', ')}`);
  process.exit(1);
}

function runMigrations() {
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
      'Confirme DIRECT_URL no Railway: Supabase → Project Settings → Database → Connection string → URI (Direct connection).',
    );
    console.error('Não uses o host pooler na porta 5432; o direct costuma ser *.connect.supabase.com ou db.*.supabase.co');
    process.exit(1);
  }
}

runMigrations();
require('./src/server');
