// Railway pre-deploy entrypoint. It is intentionally separate from app startup.
const { execSync } = require('node:child_process');
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  if (!process.env[key]?.trim()) throw new Error(`Missing required variable: ${key}`);
}
console.log('[predeploy] Applying Prisma migrations...');
execSync('npx prisma migrate deploy', { cwd: __dirname, stdio: 'inherit', env: process.env });
console.log('[predeploy] Migrations completed.');
