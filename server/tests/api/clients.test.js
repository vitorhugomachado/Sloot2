import { describe, expect, it } from 'vitest';
import { api, hasTestDb, staffLogin } from '../helpers/apiClient.js';

describe.skipIf(!hasTestDb)('API /clients', () => {
  it('cria e lista cliente', async () => {
    const login = await staffLogin();
    expect(login.token).toBeTruthy();

    const suffix = Date.now();
    const clientName = `Test Client ${suffix}`;
    const clientPhone = `5511976${String(suffix).slice(-7)}`;
    const client = api(login.token);

    const createRes = await client.post('/api/clients').send({
      name: clientName,
      phone: clientPhone,
    });
    expect(createRes.status).toBe(201);

    const listRes = await client.get(
      `/api/clients?page=1&pageSize=10&search=${encodeURIComponent(clientName)}`
    );
    expect(listRes.status).toBe(200);
    const items = listRes.body?.items;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((c) => c.phone === clientPhone)).toBe(true);
  });
});
