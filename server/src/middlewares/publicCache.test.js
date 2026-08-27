import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { cachePublic } = require('./publicCache');

function responseDouble() {
  return {
    body: undefined,
    headers: {},
    varyValues: [],
    set(name, value) { this.headers[name] = value; return this; },
    vary(value) { this.varyValues.push(value); return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('publicCache', () => {
  it('separa cache por tenant e declara o header no Vary', () => {
    const middleware = cachePublic(60);
    const url = `/api/public/bootstrap?case=${Date.now()}`;

    const run = (slug, freshBody) => {
      const req = { method: 'GET', tenantSlug: slug, headers: { 'x-tenant-slug': slug }, originalUrl: url };
      const res = responseDouble();
      let nextCalled = false;
      middleware(req, res, () => {
        nextCalled = true;
        res.json(freshBody);
      });
      return { res, nextCalled };
    };

    const firstA = run('tenant-a', { barbers: ['A'] });
    const firstB = run('tenant-b', { barbers: ['B'] });
    const cachedA = run('tenant-a', { barbers: ['ERRADO'] });

    expect(firstA.nextCalled).toBe(true);
    expect(firstB.nextCalled).toBe(true);
    expect(cachedA.nextCalled).toBe(false);
    expect(cachedA.res.body).toEqual({ barbers: ['A'] });
    expect(cachedA.res.varyValues).toContain('X-Tenant-Slug');
  });
});
