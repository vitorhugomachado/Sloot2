import { describe, expect, it } from 'vitest';
import {
  api,
  app,
  hasTestDb,
  MANAGER_EMAIL,
  MANAGER_PASSWORD,
  PILOT_SLUG,
  request,
  staffLogin,
} from '../helpers/apiClient.js';

describe.skipIf(!hasTestDb)('Segurança /auth', () => {
  it('rejeita rota protegida sem Authorization', async () => {
    const res = await request(app)
      .get('/api/clients')
      .set('X-Tenant-Slug', PILOT_SLUG);

    expect(res.status).toBe(401);
    expect(res.body?.message).toMatch(/token/i);
  });

  it('rejeita token Bearer inválido', async () => {
    const res = await api('token-invalido').get('/api/clients');
    expect(res.status).toBe(401);
    expect(res.body?.message).toMatch(/token/i);
  });

  it('login não expõe hash de senha no body', async () => {
    const login = await staffLogin(PILOT_SLUG, MANAGER_EMAIL, MANAGER_PASSWORD);
    expect(login.status).toBe(200);
    expect(login.body?.user?.password).toBeUndefined();
    expect(login.body?.user?.passwordHash).toBeUndefined();
    expect(JSON.stringify(login.body)).not.toMatch(/passwordHash/i);
  });
});
