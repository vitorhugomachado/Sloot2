import { describe, expect, it } from 'vitest';
import {
  app,
  hasTestDb,
  platformLogin,
  request,
  staffLogin,
} from '../helpers/apiClient.js';

describe.skipIf(!hasTestDb)('Segurança / platform', () => {
  it('rejeita acesso à plataforma sem token', async () => {
    const res = await request(app).get('/api/platform/stats');
    expect(res.status).toBe(401);
    expect(res.body?.message).toMatch(/token/i);
  });

  it('rejeita token de staff em rota da plataforma', async () => {
    const login = await staffLogin();
    expect(login.token).toBeTruthy();

    const res = await request(app)
      .get('/api/platform/stats')
      .set('Authorization', `Bearer ${login.token}`);

    expect(res.status).toBe(403);
    expect(res.body?.message).toMatch(/plataforma/i);
  });

  it('autentica admin da plataforma e acessa stats', async () => {
    const login = await platformLogin();
    if (login.status !== 200 || !login.token) {
      // Credenciais platform podem não existir no ambiente local
      return;
    }

    const res = await request(app)
      .get('/api/platform/stats')
      .set('Authorization', `Bearer ${login.token}`);

    expect(res.status).toBe(200);
    expect(res.body?.tenants).toBeDefined();
  });
});
