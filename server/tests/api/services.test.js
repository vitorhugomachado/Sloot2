import { afterEach, describe, expect, it } from 'vitest';
import { api, hasTestDb, staffLogin } from '../helpers/apiClient.js';

const createdServiceIds = [];

describe.skipIf(!hasTestDb)('Services API booking icon', () => {
  afterEach(async () => {
    if (!createdServiceIds.length) return;
    const login = await staffLogin();
    const client = api(login.token);
    await Promise.all(createdServiceIds.splice(0).map((id) => client.delete(`/api/services/${id}`)));
  });

  it('persiste um ícone permitido e rejeita valores desconhecidos', async () => {
    const login = await staffLogin();
    const client = api(login.token);
    const created = await client.post('/api/services').send({
      name: `Serviço visual ${Date.now()}`,
      duration: '30 min',
      price: 42,
      commissionPct: 50,
      bookingIcon: 'beard',
    });

    expect(created.status).toBe(200);
    expect(created.body.bookingIcon).toBe('beard');
    createdServiceIds.push(created.body.id);

    const invalid = await client.put(`/api/services/${created.body.id}`).send({ bookingIcon: 'desconhecido' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toMatch(/ícone/i);

    const services = await client.get('/api/services');
    expect(services.body.find((service) => service.id === created.body.id)?.bookingIcon).toBe('beard');
  });

  it('atribui generic quando um cliente antigo não envia o novo campo', async () => {
    const login = await staffLogin();
    const created = await api(login.token).post('/api/services').send({
      name: `Serviço compatível ${Date.now()}`,
      duration: '30 min',
      price: 30,
      commissionPct: 50,
    });

    expect(created.status).toBe(200);
    expect(created.body.bookingIcon).toBe('generic');
    createdServiceIds.push(created.body.id);
  });
});
