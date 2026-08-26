const base = process.argv[2]?.replace(/\/$/, '');
const expectedSha = process.argv[3];
if (!base) throw new Error('Usage: node scripts/verify-environment.mjs <url> [expected-sha]');
async function check(path, expectedStatus = 200) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  if (response.status !== expectedStatus) throw new Error(`${path}: expected ${expectedStatus}, got ${response.status}`);
  return response;
}
const health = await (await check('/health')).json();
await check('/ready');
await check('/');
if (expectedSha && health.gitSha && health.gitSha !== expectedSha) throw new Error(`SHA mismatch: expected ${expectedSha}, got ${health.gitSha}`);
console.log(JSON.stringify({ ok: true, url: base, gitSha: health.gitSha ?? null }));
