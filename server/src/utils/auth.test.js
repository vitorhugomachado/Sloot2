import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
} = require('./auth');

describe('auth utils', () => {
  it('generateToken e verifyToken fazem round-trip do payload', () => {
    const payload = { id: 42, role: 'Gerente', tenantId: 7 };
    const token = generateToken(payload);
    const decoded = verifyToken(token);

    expect(decoded).toMatchObject(payload);
  });

  it('verifyToken retorna null para token adulterado', () => {
    const token = generateToken({ id: 1, role: 'Barbeiro', tenantId: 1 });
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.id = 999;
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    expect(verifyToken(tampered)).toBeNull();
  });

  it('verifyToken retorna null para token com assinatura inválida', () => {
    const token = generateToken({ id: 1, role: 'Barbeiro', tenantId: 1 });
    expect(verifyToken(`${token}x`)).toBeNull();
  });

  it('verifyToken retorna null para token assinado com secret diferente', () => {
    const foreignToken = jwt.sign(
      { id: 1, role: 'Gerente', tenantId: 1 },
      'outro-secret-totalmente-diferente',
      { expiresIn: '7d' },
    );

    expect(verifyToken(foreignToken)).toBeNull();
  });

  it('comparePassword aceita senha correta e rejeita incorreta', async () => {
    const hash = await hashPassword('SlootiPiloto123');

    expect(await comparePassword('SlootiPiloto123', hash)).toBe(true);
    expect(await comparePassword('senha-errada', hash)).toBe(false);
  });
});
