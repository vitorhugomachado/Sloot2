import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  ALT_TENANT_SLUG,
  api,
  BARBER_EMAIL,
  BARBER_PASSWORD,
  checkAltTenantExists,
  hasTestDb,
  PILOT_SLUG,
  staffLogin,
} from '../helpers/apiClient.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

describe.skipIf(!hasTestDb)('Business settings API', () => {
  it('retorna o contrato administrativo e protege edição concorrente com revisão', async () => {
    const login = await staffLogin();
    expect(login.token).toBeTruthy();
    const client = api(login.token);
    const current = await client.get('/api/business/settings');

    expect(current.status).toBe(200);
    expect(current.body).toMatchObject({
      revision: expect.any(String),
      profile: expect.any(Object),
      bookingPageConfig: { schemaVersion: 1, galleryAssetIds: expect.any(Array) },
      weeklyHours: expect.any(Array),
      storageConfigured: expect.any(Boolean),
    });

    const payload = {
      revision: current.body.revision,
      profile: current.body.profile,
      bookingPageConfig: current.body.bookingPageConfig,
      weeklyHours: current.body.weeklyHours,
    };
    await client.get('/api/public/bootstrap');
    const cachedBootstrap = await client.get('/api/public/bootstrap');
    expect(cachedBootstrap.headers['x-cache']).toBe('HIT');
    const saved = await client.put('/api/business/settings').send(payload);
    expect(saved.status).toBe(200);
    expect(saved.body.revision).not.toBe(current.body.revision);
    const refreshedBootstrap = await client.get('/api/public/bootstrap');
    expect(refreshedBootstrap.headers['x-cache']).toBe('MISS');

    const conflict = await client.put('/api/business/settings').send(payload);
    expect(conflict.status).toBe(409);
    expect(conflict.body?.message).toMatch(/outra sessão/i);
  });

  it('impede funcionário de ler ou publicar as configurações', async () => {
    const login = await staffLogin(PILOT_SLUG, BARBER_EMAIL, BARBER_PASSWORD);
    expect(login.token).toBeTruthy();

    const result = await api(login.token).get('/api/business/settings');
    expect(result.status).toBe(403);
  });

  it('impede token do tenant A com cabeçalho do tenant B', async () => {
    if (!(await checkAltTenantExists())) return;
    const login = await staffLogin();

    const result = await api(login.token, ALT_TENANT_SLUG).get('/api/business/settings');
    expect(result.status).toBe(403);
  });

  it('recusa upload que não seja JPEG válido', async () => {
    const login = await staffLogin();
    const result = await api(login.token)
      .post('/api/business/booking-page/media?purpose=cover')
      .set('Content-Type', 'image/jpeg')
      .send(Buffer.from('não é uma imagem'));

    expect(result.status).toBe(415);
  });

  it('normaliza JPEG para WebP, entrega pela URL estável e permite remover rascunho', async () => {
    const login = await staffLogin();
    const jpeg = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#222222' },
    }).jpeg().toBuffer();
    const client = api(login.token);
    const upload = await client
      .post('/api/business/booking-page/media?purpose=gallery')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg);

    expect(upload.status).toBe(201);
    expect(upload.body?.assetId).toMatch(/^[0-9a-f-]{36}$/);
    expect(upload.body?.previewUrl).toBe(`/api/public/booking-media/${PILOT_SLUG}/${upload.body.assetId}`);

    const publicMedia = await client.raw.get(upload.body.previewUrl);
    expect(publicMedia.status).toBe(200);
    expect(publicMedia.headers['content-type']).toMatch(/^image\/webp/);

    if (await checkAltTenantExists()) {
      const crossTenantRead = await client.raw.get(
        `/api/public/booking-media/${ALT_TENANT_SLUG}/${upload.body.assetId}`,
      );
      expect(crossTenantRead.status).toBe(404);
    }

    const removed = await client.delete(`/api/business/booking-page/media/${upload.body.assetId}`);
    expect(removed.status).toBe(204);
    expect((await client.raw.get(upload.body.previewUrl)).status).toBe(404);
  });
});
