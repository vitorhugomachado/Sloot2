/**
 * Captura prints reais do sistema para a landing page.
 * Requer Vite :5173 + API :3001.
 *
 *   node scripts/capture-landing-screens.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'landing');
const BASE = process.env.CAPTURE_BASE || 'http://localhost:5173';
const SLUG = process.env.TENANT_SLUG || 'two-brothers';
const EMAIL = process.env.CAPTURE_LOGIN_EMAIL || 'admin@admin.com';
const PASSWORD = process.env.CAPTURE_LOGIN_PASSWORD || 'admin';
const FOCUS_DATE = process.env.CAPTURE_FOCUS_DATE || '2026-06-02';

async function staffLogin(page) {
  await page.goto(`${BASE}/${SLUG}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('.staff-login-field__input[type="email"]').fill(EMAIL);
  await page.locator('.staff-login-field__input[type="password"]').fill(PASSWORD);
  await page.locator('.staff-login-card__submit').click();

  const err = page.locator('.staff-login-card__alert');
  const ok = page.locator('.dash-page, .scheduler-page, .finance-page');
  const result = await Promise.race([
    ok.first().waitFor({ state: 'visible', timeout: 40000 }).then(() => 'ok'),
    err.waitFor({ state: 'visible', timeout: 40000 }).then(() => 'fail'),
  ]);
  if (result === 'fail') {
    throw new Error(`Login falhou: ${await err.innerText()}`);
  }
  await page.waitForTimeout(1500);
}

async function pickDashboardDate(page) {
  const target = new Date(`${FOCUS_DATE}T12:00:00`);
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayLabel = labels[target.getDay()];
  const dayNum = String(target.getDate());
  const col = page.locator('.dash-mini-cal-col').filter({
    has: page.locator('.dash-mini-cal-day-label', { hasText: dayLabel }),
  }).filter({
    has: page.locator('.dash-mini-cal-day-num', { hasText: dayNum }),
  });
  if (await col.count()) {
    await col.first().click();
    await page.waitForTimeout(600);
  }
}

async function waitForStaffReady(page) {
  await page.locator('.sidebar .nav-item').first().waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForTimeout(1500);
}

async function goToTab(page, tabId) {
  const labels = {
    dashboard: 'Dashboard',
    scheduler: 'Agendamentos',
    clients: 'Clientes',
    finance: 'Financeiro',
    inventory: 'Estoque',
  };
  const label = labels[tabId];
  if (tabId === 'dashboard') {
    await page.goto(`${BASE}/${SLUG}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(new RegExp(`/${SLUG}/dashboard/?$`), { timeout: 30000 });
  } else {
    await page.locator('.sidebar .nav-item').filter({ hasText: label }).click();
    await page.waitForURL(new RegExp(`/${SLUG}/dashboard/${tabId}`), { timeout: 30000 });
  }
  await page.waitForTimeout(1200);
}

async function captureStaff(page, tabId, selector, filename) {
  await goToTab(page, tabId);
  const activePanel = page.locator('.staff-tab-panel:not([hidden])');
  await activePanel.locator(selector).first().waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(800);
  await activePanel.locator(selector).first().screenshot({
    path: path.join(OUT_DIR, filename),
    type: 'png',
  });
  console.log(`  ✓ ${filename}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
  });

  const page = await desktop.newPage();
  console.log('Login staff…');
  await staffLogin(page);
  await waitForStaffReady(page);

  console.log('Dashboard…');
  await goToTab(page, 'dashboard');
  await page.locator('.staff-tab-panel:not([hidden]) .dash-page').waitFor({ state: 'visible', timeout: 30000 });
  await pickDashboardDate(page);
  await page.waitForTimeout(800);
  await page.locator('.staff-tab-panel:not([hidden]) .dash-page').screenshot({
    path: path.join(OUT_DIR, 'dashboard.png'),
    type: 'png',
  });
  console.log('  ✓ dashboard.png');

  await captureStaff(page, 'scheduler', '.scheduler-page', 'scheduler.png');
  await captureStaff(page, 'finance', '.finance-page', 'finance.png');
  await captureStaff(page, 'clients', '.clients-page', 'clients.png');
  await captureStaff(page, 'inventory', '.inventory-page', 'inventory.png');

  const mpage = await mobile.newPage();
  console.log('Agendamento público…');
  await mpage.goto(`${BASE}/${SLUG}`, { waitUntil: 'domcontentloaded' });
  await mpage.locator('.public-booking-page').waitFor({ state: 'visible', timeout: 30000 });
  await mpage.waitForTimeout(1500);
  await mpage.locator('.public-booking-page').screenshot({
    path: path.join(OUT_DIR, 'booking-mobile.png'),
    type: 'png',
  });
  console.log('  ✓ booking-mobile.png');

  await browser.close();
  console.log(`\nSalvo em public/landing/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
