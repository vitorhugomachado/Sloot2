import { describe, expect, it } from 'vitest';
import {
  api,
  BARBER_EMAIL,
  BARBER_PASSWORD,
  hasTestDb,
  PILOT_SLUG,
  staffLogin,
} from '../helpers/apiClient.js';

describe.skipIf(!hasTestDb)('Segurança / RBAC', () => {
  it('barbeiro não pode criar serviço (apenas gerente)', async () => {
    const login = await staffLogin(PILOT_SLUG, BARBER_EMAIL, BARBER_PASSWORD);
    expect(login.token).toBeTruthy();

    const res = await api(login.token).post('/api/services').send({
      name: `Serviço Teste ${Date.now()}`,
      price: 50,
      duration: '30 min',
    });

    expect(res.status).toBe(403);
    expect(res.body?.message).toMatch(/gestão/i);
  });

  it('gerente pode criar e listar clientes', async () => {
    const login = await staffLogin();
    expect(login.token).toBeTruthy();

    const suffix = Date.now();
    const clientName = `Sec Client ${suffix}`;
    const clientPhone = `5511988${String(suffix).slice(-7)}`;
    const client = api(login.token);

    const createRes = await client.post('/api/clients').send({
      name: clientName,
      phone: clientPhone,
    });
    expect(createRes.status).toBe(201);

    const listRes = await client.get(
      `/api/clients?page=1&pageSize=10&search=${encodeURIComponent(clientName)}`,
    );
    expect(listRes.status).toBe(200);
    expect(listRes.body?.items?.some((c) => c.phone === clientPhone)).toBe(true);
  });

  it('barbeiro sem módulo finance não acessa despesas', async () => {
    const login = await staffLogin(PILOT_SLUG, BARBER_EMAIL, BARBER_PASSWORD);
    expect(login.token).toBeTruthy();

    const res = await api(login.token).get('/api/expenses');
    expect(res.status).toBe(403);
    expect(res.body?.message).toMatch(/permissão|módulo/i);
  });
});
