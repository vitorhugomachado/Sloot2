import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { validateStrongPassword } = require('./passwordPolicy');

describe('validateStrongPassword', () => {
  it('aceita senha forte válida', () => {
    expect(validateStrongPassword('Slooti123')).toBeNull();
  });

  it('exige pelo menos 8 caracteres', () => {
    expect(validateStrongPassword('Ab1')).toContain('8 caracteres');
  });

  it('exige letra maiúscula', () => {
    expect(validateStrongPassword('slooti123')).toContain('maiúscula');
  });

  it('exige letra minúscula', () => {
    expect(validateStrongPassword('SLOOTI123')).toContain('minúscula');
  });

  it('exige número', () => {
    expect(validateStrongPassword('SlootiTest')).toContain('número');
  });
});
