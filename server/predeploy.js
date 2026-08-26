// Railway pre-deploy entrypoint. It is intentionally separate from app startup.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  if (!process.env[key]?.trim()) throw new Error(`Missing required variable: ${key}`);
}

// The historical database was created before Prisma migrations were committed,
// so there is no initial migration to apply to a brand-new database. This path
// is deliberately opt-in and must never be enabled in production.
if (process.env.STAGING_BOOTSTRAP === 'true') {
  if (process.env.NODE_ENV === 'production' && process.env.RAILWAY_ENVIRONMENT_NAME !== 'staging') {
    throw new Error('STAGING_BOOTSTRAP is only allowed in the isolated staging environment');
  }
  console.log('[predeploy] Bootstrapping isolated staging schema from Prisma schema...');
  execSync('npx prisma db push --accept-data-loss --skip-generate', { cwd: __dirname, stdio: 'inherit', env: process.env });

  const migrationsDir = path.join(__dirname, 'prisma', 'migrations');
  const migrations = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const migration of migrations) {
    execSync(`npx prisma migrate resolve --applied ${migration}`, {
      cwd: __dirname,
      stdio: 'inherit',
      env: process.env,
    });
  }
}

console.log('[predeploy] Applying Prisma migrations...');
execSync('npx prisma migrate deploy', { cwd: __dirname, stdio: 'inherit', env: process.env });
console.log('[predeploy] Migrations completed.');
