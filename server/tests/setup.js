import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverDir, '.env'), quiet: true });

process.env.HAS_TEST_DB = process.env.DATABASE_URL?.trim() ? '1' : '';

/**
 * Pré-requisitos para testes de API / segurança (server/tests/**):
 *   node server/scripts/seed_pilot_tenant.js
 *
 * Cross-tenant (tenantIsolation): tenant secundário deve existir
 *   (ex.: two-brothers via db:railway:setup ou ALT_TENANT_SLUG no .env)
 *
 * Platform (platform.security): admin da plataforma
 *   PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD (default: admin@sloot.com)
 *
 * Lacunas conhecidas (fora de escopo desta fase):
 *   - Sem rate limiting em login
 *   - CORS permissivo (cors() default)
 */
