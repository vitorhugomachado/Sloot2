import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('../../src/app');

export const PILOT_SLUG = (process.env.PILOT_SLUG || 'slooti-piloto').trim().toLowerCase();
export const MANAGER_EMAIL = process.env.PILOT_MANAGER_EMAIL || 'gerente@slooti-piloto.test';
export const MANAGER_PASSWORD = process.env.PILOT_MANAGER_PASSWORD || 'SlootiPiloto123';
export const BARBER_EMAIL = process.env.PILOT_BARBER_EMAIL || 'barbeiro@slooti-piloto.test';
export const BARBER_PASSWORD = process.env.PILOT_BARBER_PASSWORD || 'SlootiPiloto123';
export const ALT_TENANT_SLUG = (process.env.ALT_TENANT_SLUG || 'two-brothers').trim().toLowerCase();
export const PLATFORM_ADMIN_EMAIL = (
  process.env.PLATFORM_ADMIN_EMAIL || 'admin@sloot.com'
).trim().toLowerCase();
export const PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || 'SenhaSegura1';
export const hasTestDb = Boolean(process.env.DATABASE_URL?.trim());

let altTenantExistsCache = null;

export async function checkAltTenantExists() {
  if (!hasTestDb) return false;
  if (altTenantExistsCache !== null) return altTenantExistsCache;

  const prisma = require('../../src/lib/prisma.js');
  const tenant = await prisma.tenant.findUnique({ where: { slug: ALT_TENANT_SLUG } });
  altTenantExistsCache = Boolean(tenant);
  return altTenantExistsCache;
}

export async function staffLogin(slug = PILOT_SLUG, email = MANAGER_EMAIL, password = MANAGER_PASSWORD) {
  const res = await request(app)
    .post('/api/auth/login')
    .set('X-Tenant-Slug', slug)
    .send({ email, password });

  return {
    status: res.status,
    token: res.body?.token,
    body: res.body,
  };
}

export async function platformLogin(
  email = PLATFORM_ADMIN_EMAIL,
  password = PLATFORM_ADMIN_PASSWORD,
) {
  const res = await request(app)
    .post('/api/platform/login')
    .send({ email, password });

  return {
    status: res.status,
    token: res.body?.token,
    body: res.body,
  };
}

export function api(token, slug = PILOT_SLUG) {
  const agent = request(app);
  const withTenant = (req) => req.set('X-Tenant-Slug', slug);
  const withAuth = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);

  return {
    get: (url) => withAuth(withTenant(agent.get(url))),
    post: (url) => withAuth(withTenant(agent.post(url))),
    put: (url) => withAuth(withTenant(agent.put(url))),
    patch: (url) => withAuth(withTenant(agent.patch(url))),
    delete: (url) => withAuth(withTenant(agent.delete(url))),
    raw: agent,
  };
}

export { app, request };
