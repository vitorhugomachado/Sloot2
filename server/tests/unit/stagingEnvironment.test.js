import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isIsolatedRailwayStaging } = require('../../scripts/lib/stagingEnvironment');

describe('isolated Railway staging guard', () => {
  it('permite o piloto somente no ambiente staging explicitamente habilitado', () => {
    expect(isIsolatedRailwayStaging({
      STAGING_BOOTSTRAP: 'true',
      RAILWAY_ENVIRONMENT_NAME: 'staging',
    })).toBe(true);
  });

  it('nunca habilita o piloto no ambiente de produção', () => {
    expect(isIsolatedRailwayStaging({
      STAGING_BOOTSTRAP: 'true',
      RAILWAY_ENVIRONMENT_NAME: 'production',
    })).toBe(false);
    expect(isIsolatedRailwayStaging({ RAILWAY_ENVIRONMENT_NAME: 'staging' })).toBe(false);
  });
});
