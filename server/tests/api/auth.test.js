import { describe, expect, it } from 'vitest';
import {
  hasTestDb,
  MANAGER_EMAIL,
  MANAGER_PASSWORD,
  PILOT_SLUG,
  staffLogin,
} from '../helpers/apiClient.js';

describe.skipIf(!hasTestDb)('API /auth', () => {
  it('autentica gerente do tenant piloto', async () => {
    const login = await staffLogin();
    expect(login.status).toBe(200);
    expect(login.token).toBeTruthy();
  });

  it('rejeita credencial inválida', async () => {
    const login = await staffLogin(PILOT_SLUG, MANAGER_EMAIL, 'senha-errada');
    expect(login.status).toBe(401);
    expect(login.token).toBeUndefined();
  });
});
