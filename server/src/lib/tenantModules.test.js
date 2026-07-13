import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  ALL_TENANT_MODULES,
  DEFAULT_ENABLED_MODULES,
  normalizeModuleList,
  intersectPermissions,
  validateEnabledModulesPayload,
} = require('./tenantModules');

describe('normalizeModuleList', () => {
  it('retorna módulos padrão quando raw é null', () => {
    expect(normalizeModuleList(null)).toEqual(DEFAULT_ENABLED_MODULES);
  });

  it('filtra IDs inválidos e mantém ordem canônica', () => {
    const result = normalizeModuleList(['clients', 'modulo-inexistente', 'scheduler']);
    expect(result).toEqual(['scheduler', 'clients']);
    expect(result).not.toContain('modulo-inexistente');
  });

  it('parseia JSON string válido', () => {
    expect(normalizeModuleList('["clients","finance"]')).toEqual(['clients', 'finance']);
  });
});

describe('intersectPermissions', () => {
  it('remove permissão do barbeiro quando tenant não habilita o módulo', () => {
    const tenantModules = ['scheduler', 'dashboard'];
    const barberPerms = ['scheduler', 'clients'];

    expect(intersectPermissions(barberPerms, tenantModules)).toEqual(['scheduler']);
  });

  it('aceita alias products quando tenant tem inventory', () => {
    const tenantModules = ['inventory', 'scheduler'];
    const barberPerms = ['products', 'scheduler'];

    expect(intersectPermissions(barberPerms, tenantModules)).toEqual(['products', 'scheduler']);
  });

  it('retorna vazio quando barbeiro não tem permissões válidas', () => {
    expect(intersectPermissions(['finance'], ['scheduler'])).toEqual([]);
  });
});

describe('validateEnabledModulesPayload', () => {
  it('rejeita array vazio com status 400', () => {
    try {
      validateEnabledModulesPayload([]);
      expect.unreachable('deveria lançar');
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.message).toContain('módulo');
    }
  });

  it('rejeita módulo inválido', () => {
    try {
      validateEnabledModulesPayload(['clients', 'hack-module']);
      expect.unreachable('deveria lançar');
    } catch (err) {
      expect(err.status).toBe(400);
    }
  });

  it('aceita lista válida e normaliza', () => {
    const result = validateEnabledModulesPayload(['finance', 'clients']);
    expect(result).toEqual(['clients', 'finance']);
    expect(result.every((m) => ALL_TENANT_MODULES.includes(m))).toBe(true);
  });
});
