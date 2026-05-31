/**
 * Captura print do dashboard (foco 02/06) para a landing page.
 * Requer: Vite (5173) + API (3001) rodando.
 *
 *   npx -y playwright@1.49.1 install chromium
 *   node scripts/capture-landing-dashboard.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'landing', 'dashboard-hero-02-06.png');
const SLUG = process.env.TENANT_SLUG || 'two-brothers';
const LOGIN_EMAIL = process.env.CAPTURE_LOGIN_EMAIL || 'admin@admin.com';
const LOGIN_PASSWORD = process.env.CAPTURE_LOGIN_PASSWORD || 'admin';
const TARGET_DATE = process.env.CAPTURE_FOCUS_DATE || '2026-06-02';

async function main() {
  await mkdir(path.dirname(OUT), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(`http://localhost:5173/${SLUG}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('.staff-login-field__input[type="email"]').fill(LOGIN_EMAIL);
  await page.locator('.staff-login-field__input[type="password"]').fill(LOGIN_PASSWORD);
  await page.locator('.staff-login-card__submit').click();

  const loginError = page.locator('.staff-login-card__alert');
  const dash = page.locator('.dash-page');
  const result = await Promise.race([
    dash.waitFor({ state: 'visible', timeout: 35000 }).then(() => 'ok'),
    loginError.waitFor({ state: 'visible', timeout: 35000 }).then(() => 'fail'),
  ]);
  if (result === 'fail') {
    const msg = await loginError.innerText();
    throw new Error(`Login falhou: ${msg}`);
  }
  await page.waitForTimeout(2000);

  const target = new Date(`${TARGET_DATE}T12:00:00`);
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayLabel = dayLabels[target.getDay()];
  const dayNum = String(target.getDate());

  const dayCol = page.locator('.dash-mini-cal-col').filter({
    has: page.locator('.dash-mini-cal-day-label', { hasText: dayLabel }),
  }).filter({
    has: page.locator('.dash-mini-cal-day-num', { hasText: dayNum }),
  });

  if (await dayCol.count()) {
    await dayCol.first().click();
    await page.waitForTimeout(800);
  }

  const panel = page.locator('.dash-page');
  await panel.waitFor({ state: 'visible' });
  await panel.screenshot({ path: OUT, type: 'png' });

  await browser.close();
  console.log(`Salvo: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
