import { describe, expect, it } from 'vitest';
import { app, hasTestDb, request } from '../helpers/apiClient.js';

describe('GET /health', () => {
  it('retorna status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
