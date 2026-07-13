import { beforeAll, describe, expect, it } from 'vitest';
import {
  ALT_TENANT_SLUG,
  api,
  app,
  checkAltTenantExists,
  hasTestDb,
  request,
  staffLogin,
} from '../helpers/apiClient.js';

describe.skipIf(!hasTestDb)('Segurança / tenant isolation', () => {
  let hasAltTenant = false;

  beforeAll(async () => {
    hasAltTenant = await checkAltTenantExists();
  });

  it('rejeita requisição sem X-Tenant-Slug', async () => {
    const login = await staffLogin();
    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${login.token}`);

    expect(res.status).toBe(400);
    expect(res.body?.message).toMatch(/barbearia/i);
  });

  it('rejeita slug inválido (muito curto)', async () => {
    const login = await staffLogin();
    const res = await api(login.token, 'a').get('/api/appointments');

    expect(res.status).toBe(400);
    expect(res.body?.message).toMatch(/inválido/i);
  });

  it('retorna 404 para tenant inexistente', async () => {
    const login = await staffLogin();
    const res = await api(login.token, 'tenant-que-nao-existe-xyz').get('/api/appointments');

    expect(res.status).toBe(404);
    expect(res.body?.message).toMatch(/não encontrada/i);
  });

  it.skipIf(() => !hasAltTenant)(
    'bloqueia token de um tenant usado em outro (cross-tenant)',
    async () => {
      const login = await staffLogin();
      const res = await api(login.token, ALT_TENANT_SLUG).get('/api/appointments');

      expect(res.status).toBe(403);
      expect(res.body?.message).toMatch(/sessão não pertence/i);
    },
  );
});
